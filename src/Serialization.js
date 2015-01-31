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

// This is something that looks like a Box, but doesn't expect to have any constraints. It just wraps the
// element passed in from the outside.
function RootBox(element) {
    this._element = element;
    this._children = [];
}
RootBox.prototype.element = function() { return this._element; }
RootBox.prototype.addChild = function(box) { this._children.push(box); }
RootBox.prototype.update = function(px, py) {
    for (var i = 0; i < this._children.length; i++) {
        this._children[i].update(px, py);
    }
}

function assemble(desc, parentElement) {
    var rootBox = new RootBox(parentElement);

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
        if (boxDescription.layoutWidth) b.layoutWidth = boxDescription.layoutWidth;
        if (boxDescription.layoutHeight) b.layoutHeight = boxDescription.layoutHeight;
        if (boxDescription.children) {
            assembleBox(boxDescription.children, b);
        }
    }

    assembleBox(desc.box, rootBox);
    context.addBox(rootBox);
    
    var vars = {};
    
    function findVar(name) {
        if (!name) return undefined;
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
        function strength(s) {
            if (!s) return c.Strength.medium;
            switch(s) {
                case "!weak": return c.Strength.weak;
                case "!medium": return c.Strength.medium;
                case "!strong": return c.Strength.strong;
                case "!required": return c.Strength.required;
            }
            return c.Strength.medium;
        }
        switch (expr.type) {
            case "Inequality":
                var op = (expr.operator == "<=") ? c.LEQ : c.GEQ;
                var i = new c.Inequality(_c(expr.left), op, _c(expr.right), strength(expr.strength));
                solver.addConstraint(i);
                return i;
            case "Equality":
                var i = new c.Equation(_c(expr.left), _c(expr.right), strength(expr.strength));
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
                console.log("Unhandled expression to parse: " + expr.type + " expr: ", expr);
        }
    }
    function createManipulator(context, element, x, y) {
        var manipx = null;
        var manipy = null;
        if (x) manipx = new Manipulator(x, 'x');
        if (y) manipy = new Manipulator(y, 'y');

        var direction = Hammer.DIRECTION_VERTICAL;
        if (x && y) direction = Hammer.DIRECTION_ALL;
        else if (x) direction = Hammer.DIRECTION_HORIZONTAL;

        var hammer = new Hammer.Manager(element);
        hammer.add(new Hammer.Pan({direction: direction}));

        function onEvent(manipx, manipy, e) {
            // XXX: Handle velocity wrangling for animation here.
            if (manipx) manipx.onPan(e);
            if (manipy) manipy.onPan(e);
        }

        hammer.on("panstart panmove panend pancancel", onEvent.bind(null, manipx, manipy));

        if (manipx) context.addManipulator(manipx);
        if (manipy) context.addManipulator(manipy);
    }
    // XXX: Finish parsing; need to find boxes by ID and support strength/weights.
    for (var i = 0; i < desc.constraints.length; i++) {
        var r = parser.parse(desc.constraints[i]);
        r.map(_c);
    }
    // motionConstraints: lhs, op, rhs, options
    for (var i = 0; i < desc.motionConstraints.length; i++) {
        var mc = desc.motionConstraints[i];
        if (Array.isArray(mc)) {
            context.addMotionConstraint(new MotionConstraint(findVar(mc[0]), mc[1], mc[2], mc[3]));
        } else {
            // Legacy dictionary-based syntax.
            context.addMotionConstraint(new MotionConstraint(findVar(mc.lhs), mc.op, mc.rhs, mc.options));
        }
    }
    // manipulators: variable, box, axis
    for (var i = 0; i < desc.manipulators.length; i++) {
        var m = desc.manipulators[i];
        if (m.axis) {
            // Move to new syntax.
            m[m.axis] = m.variable;
        }
        createManipulator(context, boxes[m.box].element(), findVar(m.x), findVar(m.y));
    }

    return context;
}

module.exports = { assemble: assemble };
