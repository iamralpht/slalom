var scrollingExample = {
    box: {
        id: "clip",
        className: "clip",
        children: {
            id: "image",
            className: "image"
        }
    },
    constraints: [
        "clip.left == 0",
        "clip.top == 0",
        "clip.right == 300",
        "clip.bottom == 300",
        // Specify the bounds of the image and hint its position.
        "image.right == image.left + 800 !strong",
        "image.bottom == image.top + 800 !strong",
        "image.left == 0",// !weak",
        "image.top == 0",// !weak"
    ],
    motionConstraints: [
        // Ensure that the image stays within the clip with springs.
        // XXX: We can't yet express motion constraints relative to other linear variables.
        [ "image.left", "<=", 0 ],//"clip.left" ],
        [ "image.top", "<=", 0 ],//"clip.top" ],
        [ "image.bottom", ">=", 300],//"clip.bottom" ],
        [ "image.right", ">=", 300]//"clip.right" ],
    ],
    manipulators: [
        { box: "clip", x: "image.left", y: "image.top" }
    ]
}

Slalom.Serialization.assemble(scrollingExample, document.body);
