'use strict';

/*
Copyright 2015 Ralph Thomas

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

// Windows 7-style window-based overscrolling

// These "magic" numbers come from the image assets that this demo is built with.
// There's nothing special about them.
var parentHeight = 550;
var windowWidth = 470;
var windowHeight = 427;

var contentWidth = 450;//427;
var contentHeight = (640/427) * 450;

var windowTop = (parentHeight - windowHeight) / 2;
var contentArea = { x: 10, y: 47, width: 450, height: 370 };

var windowsOverscrollExample = {
    // Outer box is the actual window.
    box: {
        id: "win",
        className: "window",
        children: [
            {
                // Inside the window is the clip.
                id: "clip",
                className: "clip",
                children: [
                    {
                        // Inside the clip is the content, which is an image.
                        id: "content",
                        className: "image"
                    }
                ]
            }
        ]
    },
    constraints: [
        // Position the outer window. All of the x values (left, right) in this example are static.
        "win.left == 0",
        "win.right == " + windowWidth,
        "win.top == " + windowTop,
        "win.bottom == win.top + " + windowHeight,

        // Position the clipping layer. It just occupies the "content area" of the window and has
        // an "overflow: hidden" style applied.
        "clip.left == " + contentArea.x,
        "clip.right == " + (contentArea.x + contentArea.width),
        "clip.top == win.top + " + contentArea.y,
        "clip.bottom == win.top + " + (contentArea.y + contentArea.height),

        // Position the content, the image.
        "content.left == " + contentArea.x,
        "content.right == " + (contentArea.x + contentArea.width),
        // The image can't go past the top of the clip, this is enforced with a linear constraint
        // so the clip will move if the content is moved (and the window will move too, because it's
        // also attached).
        "content.top <= clip.top",
        // The image can't go past the clip's bottom; the clip will move so that the image's bottom
        // and the clip's bottom stay touching.
        "content.bottom >= clip.bottom",
        // Specify the height of the image.
        "content.bottom == content.top + " + contentHeight,
        // Specify a default start position for the image.
        "content.top == " + (contentArea.y + windowTop)
    ],
    motionConstraints: [
        // Our only motion constraint is that the window's top stays where we started it.
        { lhs: "win.top", op: "==", rhs: windowTop }
    ],
    manipulators: [
        // The manipulator moves the image's top up and down.
        { variable: "content.top", box: "win", axis: "y" }
    ]
}

function makeDeclarativeWindows7Overscroll(parentElement) {
    Slalom.Serialization.assemble(windowsOverscrollExample, parentElement);
}

makeDeclarativeWindows7Overscroll(document.getElementById('win7-overscroll-example'));
