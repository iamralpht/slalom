"use strict";

var parentWidth = 320;
var parentHeight = 480;
var aspect = parentWidth / parentHeight;

var scalingExample = {
    box: {
        id: "scaleBox",
        className: "box",
        // Specify a layoutWidth and layoutHeight. This means that the box will
        // use a transform to get its correct width and height from the constraint
        // solver and will have these values as it's DOM Layout dimensions. We do
        // this because updating a transform is faster than causing a DOM relayout.
        layoutWidth: parentWidth,
        layoutHeight: parentHeight
    },
    constraints: [
        // Scale is initially 0.45
        "scale == 0.45",
        // Define some aliases for width, height and horizontal center.
        "width == scaleBox.right - scaleBox.left",
        "height == scaleBox.bottom - scaleBox.top",
        "centerX == scaleBox.left + width * 0.5",
        // We want the aspect ratio preserved, so width == height * aspect
        "width == height * " + aspect,
        // Relate the height and the scale. We define a scale of 1.0 to be the parent height.
        "height == scale * " + parentHeight,
        // Pin the bottom of the box to the bottom of the parent.
        "scaleBox.bottom == " + parentHeight,
        // Center the box horizontally.
        "centerX == " + (parentWidth / 2)
    ],
    motionConstraints: [
        // Constrain the scale with springs. We could constrain the top or something else
        // and backtracking would ensure that we got the same effect.
        { lhs: "scale", op: ">=", rhs: 0.45 },
        { lhs: "scale", op: "<=", rhs: 1 }
    ],
    manipulators: [
        // Dragging in "y" should move the top of the scaleBox.
        { variable: "scaleBox.top", box: "scaleBox", axis: "y" }
    ]
};

function makeScalingExample(parentElement) {
    var context = Slalom.Serialization.assemble(scalingExample);
    parentElement.appendChild(context.boxes()[0].element());
}
        
makeScalingExample(document.getElementById('scaling-example'));

