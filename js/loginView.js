/*global define, require, $, navigator, chrome */
/*jslint sloppy: true */
define(function (require) {
    var loginTemplate = require('text!/templates/loginView.tmpl'),
        Mustache = require('/lib/mustache.js'),

        LoginView = function (redditClient, viewContainer) {
            var letBrowserProcess = function (e) {
                    var isMac = navigator.appVersion.indexOf('Mac') !== -1,
                        openInNewTabModifier = (isMac && e.metaKey) ||
                                              (!isMac && e.ctrlKey);
                    // let the browser do what it has to do.
                    // TODO: remove code duplication!
                    return openInNewTabModifier;
                },
                navigateClientTo = function (url, callback) {
                    // TODO: remove code duplication!
                    chrome.devtools.inspectedWindow.eval("window.location.href = '" + url + "';", callback);
                },
                renderUser = function (userInfo) {
                    var templateModel = {
                            data : userInfo
                        },
                        loginView = viewContainer.html(Mustache.render(loginTemplate, templateModel));
                    $('a', loginView).click(function (e) {
                        if (letBrowserProcess(e)) {
                            return;
                        }

                        e.preventDefault();
                        navigateClientTo($(this).attr('href'));
                    });
                },
                userInfo = redditClient.getUser();

            redditClient.onLoginStatusChanged(renderUser);
            renderUser(userInfo);
        };

    return LoginView;
});