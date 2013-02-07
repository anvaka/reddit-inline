/*global chrome, console, $*/
/*jslint sloppy: true, nomen: true todo: true */

(function () {
    var ports = {},
        settingsHash = {}, // could be a localstorage

        endpoint = "http://www.reddit.com",
        defaultSubreddits = ['pics', 'funny', 'politics', 'gaming', 'AskReddit', 'worldnews', 'videos', 'IAmA', 'todayilearned', 'WTF', 'aww', 'atheism', 'technology', 'AdviceAnimals', 'sciense', 'Music', 'movies', 'bestof'],

        request = function (options) {
            if (!options.data) {
                options.data = {};
            }
            options.data.app = 'anvaka';
            $.ajax(options);
        },

        settings = function (key, value) {
            if (typeof value === 'undefined') {
                value = settingsHash[key];
                return value && JSON.parse(value);
            }
            settingsHash[key] = JSON.stringify(value);
        },

        setLoggedIn = function (loggedIn) {
            this.loggedIn = loggedIn;
            if (!loggedIn) {
                settings('modhash', null);
                settings('user', null);
            }
        },

        isLoggedIn = function () { return this.loggedIn; },

        getMyInfo = function (callback) {
            var cachedUser = settings('user');
            if (settings('modhash') && cachedUser) {
                callback(cachedUser);
                return;
            }
            request({
                url : endpoint + '/api/me.json',
                success : function (response) {
                    settings('modhash', response && response.data && response.data.modhash);
                    callback(response && response.data);
                } // todo: error
            });
        },

        getMySubreddits = function (callback) {
            request({
                url: endpoint + '/reddits/mine.json',
                success : function (response) {
                    settings('modhash', response.data.modhash);
                    var titles = response.data.children.map(function (subreddit) {
                        return subreddit.data.url.replace(/\/r\/([^\/]+)\/?/, '$1');
                    });
                    callback(titles);
                } // todo: error
            });
        },

        notifyRedditClients = function (message) {
            Object.keys(ports).forEach(function (portId_) {
                ports[portId_].postMessage(message);
            });
        },

        buildSubredditUrl = function (filters) {
            var origin = filters.subreddit,
                beforeOrAfter;
            if (filters.mode) {
                origin += filters.mode + '/.json'; // hot/new/controversial/top
                if (filters.mode === 'new' && filters.newSort) {
                    origin += '?sort=' + filters.newSort;
                }
                if (filters.mode === 'top' && filters.topSort) {
                    origin += '?t=' + filters.topSort;
                }
            } else {
                origin += '.json';
            }

            if (filters.requestedPage) {
                if (filters.requestedPage.before) {
                    beforeOrAfter = 'before=' + filters.requestedPage.before;
                } else {
                    beforeOrAfter = 'after=' + filters.requestedPage.after;
                }

                origin += origin.match(/\?/) ? '&' : '?';
                origin += 'count=' + filters.requestedPage.count + '&' + beforeOrAfter;
            }
            return endpoint + origin;
        },

        handlers = {
            getSubreddit : function (replyTo, filters) {
                request({
                    url: buildSubredditUrl(filters),
                    success: function (data) {
                        notifyRedditClients({
                            _id: replyTo,
                            data: data
                        });
                    },
                    error: function (xhr, resp) {
                        notifyRedditClients({
                            _id: replyTo,
                            data: {
                                error: xhr.responseText
                            }
                        });
                    }

                });
            },
            getUserData : function (replyTo) {
                getMyInfo(function (user) {
                    if (user) {
                        getMySubreddits(function (subreddits) {
                            notifyRedditClients({
                                _id : replyTo,
                                data: {
                                    user : user,
                                    subreddits : subreddits
                                }
                            });
                        });
                    } else {
                        // (s)he is logged out:
                        notifyRedditClients({
                            _id : replyTo,
                            data: {
                                user : user,
                                subreddits : defaultSubreddits
                            }
                        });
                    }
                });
            },
            thingAction : function (replyTo, actionInfo) {
                if (!isLoggedIn()) {
                    notifyRedditClients({
                        _id : replyTo,
                        data: {
                            error : 'Not logged in'
                        }
                    });
                    return;
                }
                actionInfo.data.uh = settings('modhash');
                request({
                    type: 'POST',
                    url: 'http://www.reddit.com/api/' + actionInfo.action,
                    data: actionInfo.data,
                    success: function (response) {
                        notifyRedditClients({
                            _id : replyTo,
                            data: { ok : 1 }
                        });
                    },
                    error: function (xhr, message) {
                        notifyRedditClients({
                            _id : replyTo,
                            data: { error: message }
                        });
                    }
                });
            }
        },

        processClientMessage = function (msg) {
            if (handlers.hasOwnProperty(msg.name)) {
                handlers[msg.name](msg._id, msg.data);
            }
        },

        sendUserInfo = function (user, subreddits) {
            notifyRedditClients({
                _id : '_signInStatusChanged',
                data: {
                    user : user,
                    subreddits : subreddits || defaultSubreddits
                }
            });
        };

    chrome.extension.onConnect.addListener(function (port) {
        if (port.name !== "redditClient") {
            return;
        }
        ports[port.portId_] = port;
        // Remove port when destroyed (eg when devtools instance is closed)
        port.onDisconnect.addListener(function (port) {
            delete ports[port.portId_];
        });
        port.onMessage.addListener(processClientMessage);
    });

    chrome.cookies.onChanged.addListener(function (changeInfo) {
        var cookie = changeInfo.cookie,
            isSessionChanged = (cookie.domain === '.reddit.com' &&
                                cookie.name === 'reddit_session');

        setLoggedIn(!cookie.removed);
        if (Object.keys(ports).length === 0) {
            // noones care.
            return;
        }

        if (isSessionChanged) {
            if (!changeInfo.removed) {
                getMyInfo(function (user) {
                    getMySubreddits(function (subreddits) {
                        sendUserInfo(user, subreddits);
                    });
                });
            } else {
                // signed out:
                sendUserInfo();
            }
        }
    });

    chrome.cookies.get({
        url: endpoint,
        name: 'reddit_session'
    }, function (cookie) {
        setLoggedIn(!!cookie);
    });



}());