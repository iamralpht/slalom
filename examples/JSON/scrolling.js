var scrollingExample = {
    box: [{ id: "xyz", className: "box" }],
    constraints: [
        "xyz.left == 0",
        "xyz.top == 0",
        "xyz.right == xyz.left + 200",
        "xyz.bottom == xyz.top + 100",
    ],
    motionConstraints: [
        { lhs: "xyz.top", op: "==", rhs: 0 }
    ],
    manipulators: [
        { variable: "xyz.top", box: "xyz", axis: "y" }
    ]
}

Slalom.Serialization.assemble(scrollingExample, document.body);
