/*global define, chrome, console, $ */
/*jslint sloppy: true todo: true nomen: true bitwise: true*/

/**
 * This is a client to background page. Background page performs
 * actual logic of talking with reddit api. This script is merely
 * a proxy between dev tools addon and background page.
 **/
define(function (require) {
    var getRandomId = function () {
            return ((Math.random() * 1000) << 0).toString();
        },

        RedditClient = function () {
            this._id = getRandomId();
            this._callbacks = {};
            this._loginChanged = [];

            var port = chrome.extension.connect({name: "redditClient"}),
                that = this,
                updateUserData = function (data) {
                    var fireChanged = (data.user && !that.user) ||
                                      (that.user && !data.user) ||
                                      (!that.user && !data.user && data.subreddits);
                    if (data.user) {
                        that.signedIn = true;
                        that.user = data.user;
                    } else {
                        that.signedIn = false;
                        that.user = null;
                    }
                    that.subreddits = data.subreddits;
                    if (fireChanged && that._loginChanged) {
                        that._loginChanged.forEach(function (callback) {
                            callback(that.user, that.subreddits);
                        });
                    }
                },
                initClient = function () {
                    that._sendMessage({
                        name: 'getUserData'
                    }, updateUserData);
                },
                serviceMessages = {
                    _signInStatusChanged : updateUserData
                };

            port.onMessage.addListener(function (response) {
                if (that._callbacks.hasOwnProperty(response._id)) {
                    var callback = that._callbacks[response._id];
                    delete that._callbacks[response._id];

                    if (typeof callback === 'function') {
                        callback(response.data);
                    }
                } else if (serviceMessages.hasOwnProperty(response._id)) {
                    serviceMessages[response._id](response.data);
                }
            });
            this._port = port;
            initClient();
        };

    RedditClient.prototype._sendMessage = function (msg, callback) {
        var messageId = this._id + getRandomId();
        msg._id = messageId;
        if (callback) {
            this._callbacks[messageId] = callback;
        }
        this._port.postMessage(msg);
    };

    RedditClient.prototype.getSubreddit = function (filters, callback, error) {
        if (typeof callback !== 'function') {
            console.warn('getSubreddit() doesn\'t have a callback. Ignoring');
            return;
        }

        this._sendMessage({
            name: 'getSubreddit',
            data: filters
        }, function (response) {
            if (!response.error) {
                // flatten the data:
                var things = response.data.children.map(function (child) { return child.data; });

                callback({
                    things : things,
                    after : response.data.after,
                    before : response.data.before
                });
            } else if (typeof error === 'function') {
                error(response.error);
            }
        });
    };

    RedditClient.prototype.vote = function (thingId, direction, votedCallback) {
        if (this.signedIn) {
            this._sendMessage({
                name : 'thingAction',
                data: {
                    action : 'vote',
                    data: {
                        id: thingId,
                        dir: direction
                    }
                }
            }, function (response) {
                if (typeof votedCallback === 'function') {
                    votedCallback(response);
                }
            });
            return true;
        }
        return false;
    };

    RedditClient.prototype.onLoginStatusChanged = function (callback) {
        if (typeof callback === 'function') {
            this._loginChanged.push(callback);
        }
    };

    RedditClient.prototype.getUser = function () {
        return this.user;
    };

    return RedditClient;
});