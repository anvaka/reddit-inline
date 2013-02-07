/*global $, define, escape */
/*jslint sloppy: true */

/**
 * Defines a model for subreddit view. Converts reddit data to something
 * more usable for a view. Talks with reddit client.
 */
define(function (require) {
    var fixPlural = function (value, singular) {
            return value === 1 ? '1 ' + singular : (value + ' ' + singular + 's');
        },
        getElapsedTime = function (createdUtc) {
            var now = new Date(),
                nowUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),  now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds(), now.getUTCMilliseconds()),
                elapsed = nowUtc - createdUtc * 1000;

            if (elapsed < 1000) { return elapsed + ' millseconds'; }
            elapsed = Math.round(elapsed / 1000); // seconds
            if (elapsed < 60) { return fixPlural(elapsed, 'second'); }
            elapsed = Math.round(elapsed / 60); // minutes
            if (elapsed < 60) { return fixPlural(elapsed, 'minute'); }
            elapsed = Math.round(elapsed / 60); // hours
            if (elapsed < 24) { return fixPlural(elapsed, 'hour'); }
            elapsed = Math.round(elapsed / 30.5); // days
            if (elapsed < 30.5) { return fixPlural(elapsed, 'day'); }
            elapsed = Math.round(elapsed / 24);
            if (elapsed < 12) { return fixPlural(elapsed, 'month'); }
            elapsed = Math.round(elapsed / 12);
            return fixPlural(elapsed, 'year');
        },
        extendThingWithTemplateProperties = function (thing) {
            // augment for easier templating:
            thing.scoreDislikes = thing.score - 1;
            thing.scoreLikes = thing.score + 1;

            // I don't want to use insecure escaping in mustache here.
            // Not that I don't trust reddit's data, but let's just
            // whitelist tags, to be on a safer side:
            var safeText = thing.title,
                voteStatus = 'unvoted',
                thumbModel,
                dateCreated;

            thing.title = safeText.replace(/&amp;/g, '&').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
            if (thing.thumbnail) {
                thumbModel = {
                    aclass : thing.thumbnail.indexOf('http') !== -1 ? '' : thing.thumbnail,
                    url : thing.url
                };
                if (thumbModel.aclass === '') {
                    thumbModel.img = {
                        url : thing.thumbnail
                    };
                }
                thing.thumb = thumbModel;
            }
            if (thing.likes === true) {
                voteStatus = 'likes';
                thing.upmod = 'mod';
            } else if (thing.likes === false) {
                voteStatus = 'dislikes';
                thing.downmod = 'mod';
            }
            thing.voteStatus = voteStatus;

            if (thing.link_flair_text) {
                thing.flair = { label : thing.link_flair_text };
            }
            dateCreated = new Date(0);
            dateCreated.setUTCSeconds(thing.created_utc);
            thing.createdUTC = dateCreated.toUTCString();
            thing.createdISO = dateCreated.toISOString();
            thing.elapsed = getElapsedTime(thing.created_utc);
            return thing;
        },

        createPagingModel = function (thingsPage, page) {
            if (!thingsPage.before && !thingsPage.after) {
                return null;
            }

            var model = {},
                thingsCount = thingsPage.things.length;
            if (thingsPage.before) {
                model.before = {
                    count: page * thingsCount + 1,
                    pageId: thingsPage.before
                };
            }
            if (thingsPage.after) {
                model.after = {
                    count:  (page + 1) * thingsCount,
                    pageId: thingsPage.after
                };
            }
            return model;
        },

        udpateCurrentPageIdx = function (model, requestedPage) {
            if (requestedPage) {
                if (requestedPage.before) {
                    // going backward:
                    model.pageIdx -= 1;
                } else if (requestedPage.after) {
                    model.pageIdx += 1;
                }
            }
        },

        normalizeSubredditName = function (plainName) {
            // don't want special characters in the url:
            plainName = plainName.replace(/(^\/r\/|\?|&|\/|\s)/g, '');
            if (!plainName) {
                return '/'; // front
            }

            return '/r/' + escape(plainName) + '/';
        },

        checkAndUpdateFilter = function (filterName, newFilter, currentFilter) {
            if (newFilter[filterName]) {
                if (filterName === 'subreddit') {
                    currentFilter[filterName] = normalizeSubredditName(newFilter[filterName]);
                } else {
                    currentFilter[filterName] = newFilter[filterName];
                }
                currentFilter.pageIdx = 0;
            }
        },

        SubredditViewModel = function (redditClient) {
            var that = this;

            this.filters = {
                mode : "hot",
                newSort : "new",
                topSort : "week",
                subreddit : "/",
                pageIdx : 0
            };
            this.redditClient = redditClient;
            this.redditClient.onLoginStatusChanged(function () {
                that.update();
            });
            this.callbacks = {};
        };
    SubredditViewModel.prototype.update = function (newFilter, requestedPage) {
        var that = this,
            currentSubreddit = this.filters.subreddit,
            isSubredditChanged = false,
            success,
            error;
        if (newFilter) {
            checkAndUpdateFilter('topSort', newFilter, this.filters);
            checkAndUpdateFilter('newSort', newFilter, this.filters);
            checkAndUpdateFilter('mode', newFilter, this.filters);
            checkAndUpdateFilter('subreddit', newFilter, this.filters);
            isSubredditChanged = (currentSubreddit !== this.filters.subreddit);
        }

        this.filters.requestedPage = requestedPage;

        that.fire('updating', this.filters.subreddit === '/' ?
                                'the front page of the internet' :
                                this.filters.subreddit);

        success = function (thingsPage) {
            udpateCurrentPageIdx(that.filters, requestedPage);
            thingsPage.things = thingsPage.things.map(extendThingWithTemplateProperties);
            thingsPage.pagingModel = createPagingModel(thingsPage, that.filters.pageIdx);
            that.fire('updated', thingsPage);
            if (isSubredditChanged) {
                that.fire('subreddit_changed', currentSubreddit, that.filters.subreddit);
            }
        };
        error = function (error) {
            var url = that.filters.subreddit,
                name = (url === '/') ? 'reddit.com' : url;
            that.fire('error', {
                url : url,
                name : name,
                response : error
            });
        };
        this.redditClient.getSubreddit(this.filters, success, error);
    };

    SubredditViewModel.prototype.vote = function (thingId, direction, votedCallback) {
        return this.redditClient.vote(thingId, direction, votedCallback);
    };

    SubredditViewModel.prototype.on = function (eventName, callback) {
        this.callbacks[eventName] = this.callbacks[eventName] || [];
        this.callbacks[eventName].push(callback);
    };

    SubredditViewModel.prototype.fire = function () {
        var eventName = arguments[0];
        if (this.callbacks.hasOwnProperty(eventName)) {
            var callbacks = this.callbacks[eventName],
                remainingArgs = Array.prototype.slice.call(arguments).slice(1);
            for (var i = 0; i < callbacks.length; i++) {
                callbacks[i].apply(undefined, remainingArgs);
            };
        }
    };

    return SubredditViewModel;
});