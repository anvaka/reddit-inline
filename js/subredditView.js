/*global define, $, navigator, console */
/*jslint sloppy: true regexp: true todo: true*/

/**
 * Represents a view class of a subreddit listing.
 */
define(function (require) {
    var Mustache = require('/lib/mustache.js'),
        thingsContainerSelector = '#thingsContainer',
        thingsTemplateDef = require('text!/templates/thing.tmpl'),
        thingsTemplate = Mustache.compile(thingsTemplateDef),
        loadingTemplateDef = require('text!/templates/logMessages.tmpl'),
        loadingTempalte = Mustache.compile(loadingTemplateDef),

        listenToHeaderTabsEvents = function (container, clickCallback) {
            var tabs = $('.tabMenu > li', container),
                newRising = $('#newrising > li', container),
                topRange = $('#toprange > li', container);

            tabs.click(function () {
                var thingsMode = this.id;

                tabs.removeClass('selected');
                $(this).addClass('selected');

                clickCallback({ mode : thingsMode });
            });

            newRising.click(function () {
                newRising.removeClass('selected');
                $(this).addClass('selected');

                var currentNewSort = this.id;

                clickCallback({newSort : currentNewSort});
            });

            topRange.click(function () {
                topRange.removeClass('selected');
                $(this).addClass('selected');

                var currentTopSort = this.id;

                clickCallback({topSort : currentTopSort});
            });
        },

        renderTabs = function (parentElement) {
            var tabsTemplate = require('text!/templates/tabs.tmpl'),
                tabs = parentElement.html(Mustache.render(tabsTemplate));

            listenToHeaderTabsEvents(tabs, this.model.update.bind(this.model));
        },

        navigateClientTo = function (url, callback) {
            chrome.devtools.inspectedWindow.eval("window.location.href = '" + url + "';", callback);
        },

        goToPage = function (pageLink, model) {
            var pageRequest = {},
                match = pageLink.match(/(before|after)=(.+)/);
            if (match) {
                pageRequest[match[1]] = match[2];
            }
            match = pageLink.match(/count=([^&]+)/);
            if (match) {
                pageRequest.count = parseInt(match[1], 10) || 0;
            }
            model.update(null, pageRequest);
        },

        openSubreddit = function (subredditLink, model) {
            model.update({
                subreddit : subredditLink.text()
            });
        },

        openLink = function (that, model) {
            var href = that.attr('href');
            if (that.hasClass('next') || that.hasClass('prev')) {
                // paging is executed inside the bar
                goToPage(href, model);
                return;
            }
            if (that.hasClass('subreddit')) {
                // subreddit links also opened inside the bar
                openSubreddit(that, model);
                return;
            }


            navigateClientTo(href, function () {
                $('.selected', thingsContainerSelector).removeClass('selected');
                that.addClass('visited')
                    .parents('.thing')
                    .addClass('selected');
            });

            return false;
        },

        voteOnThing = function (arrow, model) {
            var up_cls = "up",
                upmod_cls = "upmod",
                down_cls = "down",
                downmod_cls = "downmod",

                direction = (arrow.hasClass(up_cls) ? 1 :
                            (arrow.hasClass(down_cls) ? -1 : 0)),
                thingId = arrow.data('fullname'),
                u_before = (direction === 1) ? up_cls : upmod_cls,
                u_after  = (direction === 1) ? upmod_cls : up_cls,
                d_before = (direction === -1) ? down_cls : downmod_cls,
                d_after  = (direction === -1) ? downmod_cls : down_cls,
                midcol = arrow.parents('.midcol'),
                arrows = $('.arrow', midcol),
                onVoted = function (response) {
                    if (!response || response.error) {
                        console.error('Reddit inline got error on vote: ', response);
                        // todo: update the ui?
                        return;
                    }
                };

            /* set the new arrow states */
            arrows.filter("." + u_before).removeClass(u_before).addClass(u_after);
            arrows.filter("." + d_before).removeClass(d_before).addClass(d_after);
            if (direction > 0) {
                midcol.addClass('likes').removeClass('dislikes unvoted');
            } else if (direction < 0) {
                midcol.addClass('dislikes').removeClass('likes unvoted');
            } else {
                midcol.addClass('unvoted').removeClass('likes dislikes');
            }

            if (!model.vote(thingId, direction, onVoted)) {
                // we are signed out. 
                navigateClientTo('https://ssl.reddit.com/login');
            }
        },

        letBrowserProcess = function (e) {
            var isMac = navigator.appVersion.indexOf('Mac') !== -1,
                openInNewTabModifier = (isMac && e.metaKey) ||
                                      (!isMac && e.ctrlKey);
            // let the browser do what it has to do.
            return openInNewTabModifier;
        },

        renderEntries = function (thingsPage) {
            var thingsContainer = $(thingsContainerSelector, this.parentElement),
                model = this.model;

            thingsContainer.html(thingsTemplate(thingsPage));
            $('a', thingsContainer).click(function (e) {
                if (letBrowserProcess(e)) {
                    return;
                }
                e.preventDefault();
                openLink($(this), model);
            });
            $('.arrow', thingsContainer).click(function (e) {
                return voteOnThing($(this), model);
            });
            // well, this is not accurate...
            $('body').scrollTop(0);
        },

        showLoading = function (name) {
            var thingsContainer = $(thingsContainerSelector, this.parentElement);
            thingsContainer.html(loadingTempalte({
                loading :  {
                    name : name
                }
            }));
        },

        showError = function (error) {
            var thingsContainer = $(thingsContainerSelector, this.parentElement),
                errorContainer = thingsContainer.html(loadingTempalte({
                    error : error
                })),
                model = this.model;
            $('a', errorContainer).click(function (e) {
                if (letBrowserProcess(e)) {
                    return;
                }
                e.preventDefault();
                openLink($(this), model);
            });
        },

        SubredditView = function (model, parentElement) {
            this.model = model;
            this.parentElement = parentElement;
            this.model.on('updated', renderEntries.bind(this));
            this.model.on('updating', showLoading.bind(this));
            this.model.on('error', showError.bind(this));

            renderTabs.bind(this)($('#tabsContainer', this.parentElement));
            this.model.update();
        };

    return SubredditView;
});