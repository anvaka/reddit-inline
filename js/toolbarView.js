/*global define, chrome, console, $ */
/*jslint sloppy: true todo: true nomen: true bitwise: true regexp: true*/

/**
 * A toolbar with the list of user's subreddits
 **/
define(function (require) {
    var Mustache = require('/lib/mustache.js'),
        template = require('text!/templates/toolbarline.tmpl');

    function ToolbarView(subredditsModel, redditClient, container) {
        this.container = container;
        this.subreddits = subredditsModel;
        this.model = {
            current : "front",
            subreddits : redditClient.subreddits
        };
        this.render();

        var that = this;
        redditClient.onLoginStatusChanged(function (user, subreddits) {
            var newModel = {
                current : that.model.current,
                subreddits: subreddits
            };
            that.model = newModel;
            that.render();
        });
        subredditsModel.on('subreddit_changed', function (old, current) {
            current = current.replace(/\/r\/([^\/]+)\/?/i, '$1');
            if (current === '/') { current = 'front'; }

            var newModel = {
                current : current,
                subreddits: that.model.subreddits
            };
            that.model = newModel;
            that.render();
        });
    }

    ToolbarView.prototype.render = function () {
        var toolbar = this.container.html(Mustache.render(template, this.model)),
            searchbox = $('#gotor', toolbar),
            that = this;

        searchbox.keydown(function (e) {
            if (e.which === 13) { // enter
                that.subreddits.update({subreddit: searchbox.val()});
                searchbox.val('');
                e.preventDefault();
            } else if (e.which === 27) { // esc
                searchbox.val('');
            }
        }).blur(function (e) {
            searchbox.val('');
        });
        $('.quickGo', toolbar).mousedown(function (e) {
            // for some strang reason, wihtout timeout focus doesn't work
            setTimeout(function () { searchbox.focus(); }, 0);
        });
        $('a', toolbar).click(function (e) {
            // TODO: remove this duplication.
            var isMac = navigator.appVersion.indexOf('Mac') !== -1,
                openInNewTabModifier = (isMac && e.metaKey) ||
                                      (!isMac && e.ctrlKey);
            if (openInNewTabModifier) {
                return; // let the browser do what it has to do.
            }

            var link = $(this),
                redditName = link.text();
            if (link.hasClass('current')) {
                that.subreddits.update(); // just refresh the view
            } else {
                // Front has special treatment.
                if (redditName.match(/front/i)) {
                    that.subreddits.update({subreddit: ''});
                } else {
                    that.subreddits.update({subreddit: redditName});
                }
            }
            e.preventDefault();
        });
    };

    return ToolbarView;
});