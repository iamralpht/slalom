'use strict';

// Experiment with deserialization of Slalom examples. Eventually I want to have a simple object
// model so that it's possible to build an editor for Slalom.

//
// Assemble a Slalom example from a JSON description.
// {
//   box: [{ id: 'foo', className: 'bar', textContent: '', children: [ <more boxes> ] }],
//   constraints: [ .. ],
//   motionConstraints: [ .. ],
//   manipulators: [ .. ]
// }
//
// It's a bit odd that boxes are separated from the constraints that position them, but that's OK, it's like
// CSS where the tree position is separate from the layout properties.
//
// BUT for any editor, constraints are going to be properties of boxes. There might be some free pure constraints.
// Maybe it's wrong to think of them as box properties.

var MotionContext = require('./MotionContext.js');
var Box = require('./Box.js');
var MotionConstraint = require('./MotionConstraint.js');
var Manipulator = require('./Manipulator.js');
var parser = require('./parser/grammar.pegjs');

function assemble(desc) {
    var rootBox = new Box('');
    rootBox.element().className = 'root';

    var context = new MotionContext();
    var solver = context.solver();
    var boxes = {};

    // Build box tree.
    function assembleBox(boxDescription, parentBox) {
        // Box description may be an array or a single box.
        if (Array.isArray(boxDescription)) {
            for (var i = 0; i < boxDescription.length; i++) {
                assembleBox(boxDescription[i], parentBox);
            }
            return;
        }
        var b = new Box(boxDescription.textContent ? boxDescription.textContent : '');
        parentBox.addChild(b);
        parentBox.element().appendChild(b.element());
        // XXX: handle collisions, unspecified id, etc.
        boxes[boxDescription.id] = b;
        b.element().id = boxDescription.id;
        if (boxDescription.className) b.element().className = boxDescription.className;
        if (boxDescription.children) {
            assembleBox(boxDescription.children, b);
        }
    }

    assembleBox(desc.box, rootBox);
    context.addBox(rootBox);
    
    var vars = {};
    
    function findVar(name) {
        function makeVar(box, name) {
            if (box.hasOwnProperty(name) && box[name].isExternal)
                return box[name];
            box[name] = new c.Variable({name: name});
            return box[name];
        }
        // Return the standalone variable if we have one.
        if (vars.hasOwnProperty(name)) return vars[name];
        // If we don't have it, and it doesn't contain a "." then create a variable.
        // XXX: Might want a "variable" rule so we don't get typos creating new variables.
        if (name.indexOf('.') == -1) {
            vars[name] = new c.Variable({name: name});
            return vars[name];
        }
        var bits = name.split('.', 2);
        if (bits.length < 2 || !boxes.hasOwnProperty(bits[0])) return null;

        var box = boxes[bits[0]];
        switch (bits[1]) {
            case 'left': return makeVar(box, 'x');
            case 'right': return makeVar(box, 'right');
            case 'top': return makeVar(box, 'y');
            case 'bottom': return makeVar(box, 'bottom');
        }
        return null;
    }

    function _c(expr) {
        switch (expr.type) {
            case "Inequality":
                var op = (expr.operator == "<=") ? c.LEQ : c.GEQ;
                var i = new c.Inequality(_c(expr.left), op, _c(expr.right), weak);
                solver.addConstraint(i);
                return i;
            case "Equality":
                var i = new c.Equation(_c(expr.left), _c(expr.right), weak);
                solver.addConstraint(i);
                return i;
            case "MultiplicativeExpression":
                var i = c.times(_c(expr.left), _c(expr.right));
                return i;
            case "AdditiveExpression":
                var aop = (expr.operator == "+") ? c.plus : c.minus;
                return aop(_c(expr.left), _c(expr.right));
            case "NumericLiteral":
                return new c.Expression(expr.value);
            case "Variable":
                return findVar(expr.name);
            default:
                console.log("Unhandled expression to parse: " + expr.type);
        }
    }
    function createManipulator(variable, element, axis) {
        var manip = new Manipulator(variable, axis);
        var hammer = new Hammer.Manager(element);
        hammer.add(new Hammer.Pan({direction: (axis == 'y') ? Hammer.DIRECTION_VERTICAL : Hammer.DIRECTION_HORIZONTAL}));
        hammer.on("panstart panmove panend pancancel", manip.onPan.bind(manip));
        return manip;
    }
    // XXX: Finish parsing; need to find boxes by ID and support strength/weights.
    for (var i = 0; i < desc.constraints.length; i++) {
        var r = parser.parse(desc.constraints[i]);
        r.map(_c);
    }
    // motionConstraints: lhs, op, rhs, options
    for (var i = 0; i < desc.motionConstraints.length; i++) {
        var mc = desc.motionConstraints[i];
        context.addMotionConstraint(new MotionConstraint(findVar(mc.lhs), mc.op, mc.rhs, mc.options));
    }
    // manipulators: variable, box, axis
    for (var i = 0; i < desc.manipulators.length; i++) {
        var m = desc.manipulators[i];
        context.addManipulator(createManipulator(findVar(m.variable), boxes[m.box].element(), m.axis));
    }

    return context;
}

module.exports = { assemble: assemble };
