var scrollingExample = {
    box: [{ id: "xyz", className: "box" }],
    constraints: [
        "xyz_left == 0",
        "xyz_top == 0",
        "xyz_right == xyz_left + 100",
        "xyz_bottom == xyz_top + 100",
    ],
    motionConstraints: [
        { lhs: "xyz_top", op: "==", rhs: 0 }
    ],
    manipulators: [
        { variable: "xyz_top", box: "xyz", axis: "y" }
    ]
}

var context = Slalom.Serialization.assemble(scrollingExample);

document.body.appendChild(context.boxes()[0].element());
