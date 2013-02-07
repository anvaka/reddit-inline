/*global define, require, $, chrome, document */
/*jslint sloppy: true nomen: true*/
require.config({
    paths: {
        "text": "lib/text"
    }
});
define(function (require) {
    $(function () {
        // TODO: add initialization view for the reddit client.
        var RedditClient = require('/js/redditClient.js'),
            ToolbarView = require('/js/toolbarView.js'),
            SubredditView = require('/js/subredditView.js'),
            SubredditViewModel = require('/js/subredditViewModel.js'),
            LoginView = require('/js/loginView.js'),

            client = new RedditClient(),
            subredditModel = new SubredditViewModel(client),
            toolbarView = new ToolbarView(subredditModel, client, $('#toolbar')),
            subredditView = new SubredditView(subredditModel, $('#subredditView')),
            loginView = new LoginView(client, $('#userInfo'));
    });
    return function () {};
});

var _gaq = _gaq || [];
_gaq.push(['_setAccount', 'UA-38313082-1']);
_gaq.push(['_trackPageview']);

(function () {
    var ga = document.createElement('script'),
        s;
    ga.type = 'text/javascript';
    ga.async = true;
    ga.src = 'https://ssl.google-analytics.com/ga.js';
    s = document.getElementsByTagName('script')[0];
    s.parentNode.insertBefore(ga, s);
}());