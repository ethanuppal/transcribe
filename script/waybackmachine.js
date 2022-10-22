// Copyright (C) 2022 Ethan Uppal. All rights reserved.

var waybackMachineNoticeHTML = `
<div style="background-color: #E0E0E0; padding: 5px; font-size: 14px;">
    <p>Thanks for checking out this app! You are viewing this website in the Wayback Machine, so there may be issues with functionality and links. The live site is at <a href="https://ethanuppal.github.io/transcribe/index.html" target="_blank">https://ethanuppal.github.io/transcribe</a>.</p>
</div>`;

function detectWaybackMachine() {
    const linkPrefix = 'h' + 't' + 't' + 'p' + 's' + ':' + '/' + '/' + 'w' + 'e' + 'b' + '.' + 'a' + 'r' + 'c' + 'h' + 'i' + 'v' + 'e' + '.' + 'o' + 'r' + 'g';
    if (window.location.href.startsWith(linkPrefix)) {
        return true;
    }
    if (getUrlParameter('inside') == 'waybackmachine') {
        return true;
    }
    return false;
}

$(document).ready(function() {
    if (detectWaybackMachine()) {
        $('#header').append(waybackMachineNoticeHTML);
    }
});
