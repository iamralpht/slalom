var scrollingExample = {
    // Create two nested boxes. The outer box is a clip, and the inner box is an image to
    // pan around.
    box: {
        id: "clip",
        className: "clip",
        children: {
            id: "image",
            className: "image"
        }
    },
    constraints: [
        // The clip is going to be 300x300.
        "clip.left == 0",
        "clip.top == 0",
        "clip.right == 300",
        "clip.bottom == 300",
        // Specify the bounds of the image and hint its position; the image is 800x800.
        // We don't really need to specify the constraint strengths here, but it helps
        // to make clearer which constraints we expect to be violated.
        "image.right == image.left + 800 !strong",
        "image.bottom == image.top + 800 !strong",
        "image.left == 0 !weak",
        "image.top == 0 !weak"
    ],
    motionConstraints: [
        // Ensure that the image stays within the clip with springs.
        // XXX: We can't yet express motion constraints relative to other linear variables; would rather use clip.right instead of "300" here.
        [ "image.left", "<=", 0 ],
        [ "image.top", "<=", 0 ],
        [ "image.bottom", ">=", 300],
        [ "image.right", ">=", 300]
    ],
    manipulators: [
        // Create a manipulator that listens for events on the box "clip" and manipulates
        // "image.left" and "image.top" for the x and y components of a pan.
        { box: "clip", x: "image.left", y: "image.top" }
    ]
}

Slalom.Serialization.assemble(scrollingExample, document.body);
