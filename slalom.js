!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.Slalom=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

var dPR = window.devicePixelRatio;
function roundOffset(x) { return Math.round(x * dPR) / dPR; }

// This is a DOM block which is positioned from the constraint solver rather than
// via flow.
function Box(textContentOrElement) {
    if (textContentOrElement && textContentOrElement.style) {
        this._element = textContentOrElement;
    } else {
        this._element = document.createElement('div');
        this._element.className = 'box';
        if (textContentOrElement) this._element.textContent = textContentOrElement;
    }

    // These get replaced with constraint variables by the caller.
    this.x = 0;
    this.y = 0;
    this.right = 100;
    this.bottom = 100;

    // If these are set then we'll propagate them to the DOM and use
    // a transform to scale to the desired width. This is handy because
    // changing the DOM width/height causes a full layout+repaint which
    // isn't very incremental in WebKit/Blink.
    this.domWidth = -1;
    this.domHeight = -1;

    this._children = [];

    this.update();
}
Box.prototype.element = function() { return this._element; }
Box.prototype.addChild = function(box) { this._children.push(box); }
Box.prototype.update = function(px, py) {
    function get(variable) {
        if (variable.valueOf) return variable.valueOf();
        return variable;
    }
    var x = get(this.x);
    var y = get(this.y);
    var right = get(this.right);
    var bottom = get(this.bottom);

    var w = Math.max(0, right - x);
    var h = Math.max(0, bottom - y);

    for (var i = 0; i < this._children.length; i++) {
        this._children[i].update(x, y);
    }

    if (!px) px = 0;
    if (!py) py = 0;
    x -= px;
    y -= py;

    var xscale = 1;
    var yscale = 1;

    if (this.domWidth != -1) {
        xscale = w / this.domWidth;
        w = this.domWidth;
    }
    if (this.domHeight != -1) {
        yscale = h / this.domHeight;
        h = this.domHeight;
    }
    // Don't do rounding if we're doing transform-based scaling
    // because it makes it jumpy.
    if (xscale == 1 && yscale == 1) {
        x = roundOffset(x);
        y = roundOffset(y);
        w = roundOffset(w);
        h = roundOffset(h);
    }

    // Be careful about updating width and height since it'll
    // trigger a browser layout.
    if (w != this._lastWidth) {
        this._lastWidth = w;
        this._element.style.width = w + 'px';
    }
    if (h != this._lastHeight) {
        this._lastHeight = h;
        this._element.style.height = h + 'px';
    }
    if (x == this._lastX && y == this._lastY) return;
    this._lastX = x; this._lastY = y;
    // Use transform to set the x/y since this is the common
    // case and it generally avoids a relayout.
    var transform = 'translate3D(' + x + 'px, ' + y + 'px, 0)';
    if (xscale != 1 || yscale != 1) {
        transform += ' scale(' + xscale + ', ' + yscale + ')';
    }
    this._element.style.webkitTransform = transform;
    this._element.style.transform = transform;
}

module.exports = Box;


},{}],2:[function(require,module,exports){
"use strict";

var manipulatorCount = 0;

// This is a wrapper over a cassowary variable. It will create an edit session
// for it when dragged and listen for violations of motion constraints.
function Manipulator(variable, axis) {
    this._variable = variable;
    this._solver = null;
    this._axis = axis;
    this._context = null;

    this._motion = null;
    this._animation = null;
    this._name = 'manipulator-' + variable.name + '-' + (++manipulatorCount);

    this._hitConstraint = null;
    this._constraintCoefficient = 1;

    // There are three places that a variable gets a value from in here:
    //  1. touch manipulation (need to apply constraint when in violation)
    //  2. animation from velocity.
    //  3. animation from constraint.
    this._motionState = {
        editing: false,
        // Manipulation from touch
        dragging: false,
        dragStart: 0,
        dragDelta: 0,
        dragTriggerDelta: 0,
        // Animation from velocity (which the finger imparted)
        velocityAnimation: null,
        velocityAnimationPosition: 0,
        velocityAnimationVelocity: 0,
        // Animation from constraint (either from velocity animation, or from drag end).
        constraintAnimation: null,
        constraintAnimationPosition: 0,
        constraintAnimationVelocity: 0,
        constraintAnimationConstraint: null, // the constraint we're animating for.
        // Are we running a constraint iteration where we're pretending to have
        // an animation in order to discover constraints that only apply to
        // animations (which we wouldn't discover if we had no velocity and thus
        // didn't create an animation, for example).
        trialAnimation: false
    };
}
// This method expects the Hammer.js onPan event as an argument.
Manipulator.prototype.onPan = function(e) {
    if (e.type == 'panstart') {
        var delta = (this._axis == 'x') ? e.deltaX : e.deltaY;
        // Kill other manipulators that are doing something to a related variable.
        this._motionContext.stopOthers(this._variable);
        // Start a new edit session.
        this._motionState.dragging = true;
        this._motionState.dragStart = this._variable.valueOf();
        this._motionState.dragDelta = 0;
        this._motionState.dragTriggerDelta = delta;
        this._update();
    } else if (e.type == 'panmove') {
        var delta = (this._axis == 'x') ? e.deltaX : e.deltaY;
        this._motionState.dragDelta = delta - this._motionState.dragTriggerDelta;
        this._update();
    } else if (e.type == 'panend') {
        // We want the velocity in px/sec; Hammer gives us px/ms.
        var velocity = -((this._axis == 'x') ? e.velocityX : e.velocityY) * 1000.0;
        this._motionState.dragging = false;
        this._motionState.trialAnimation = true;
        if (this._motionContext) this._motionContext.update();
        this._createAnimation(velocity);
        this._motionState.trialAnimation = false;
    }
}
// This method is called by the MotionContext when this manipulator is added to it.
Manipulator.prototype._setMotionContext = function(motionContext) {
    this._motionContext = motionContext;
    this._solver = motionContext.solver();
    // Add a stay to the variable we're going to manipulate.
    this._solver.add(new c.StayConstraint(this._variable, c.Strength.medium, 0));
}
Manipulator.prototype.name = function() { return this._name; }
Manipulator.prototype.variable = function() { return this._variable; }
Manipulator.prototype.createMotion = function(x, v) {
    var m = new Gravitas.Friction(0.001);
    m.set(x, v);
    return m;
}
Manipulator.prototype._cancelAnimation = function(key) {
    if (!this._motionState[key]) return;
    this._motionState[key].cancel();
    this._motionState[key] = null;
}
Manipulator.prototype._update = function() {
    // What state are we in?
    //  1. Dragging -- we set the variable to the value specified and apply some
    //     damping if we're in violation of a constraint.
    //  2. Animating -- we have some momentum from a drag, and we're applying the
    //     values of an animation to the variable. We need to react if we violate
    //     a constraint.
    //  3. Constraint animating -- we already violated a constraint and now we're
    //     animating back to a non-violating position.
    //  4. Nothing is going on, we shouldn't be editing.
    //
    var self = this;
    function beginEdit() {
        if (self._motionState.editing) return;
        self._solver.beginEdit(self._variable, c.Strength.strong);
        self._motionState.editing = true;
    }

    if (this._motionState.dragging) {
        // 1. Dragging.

        // Kill any animations we already have.
        this._cancelAnimation('velocityAnimation');
        this._cancelAnimation('constraintAnimation');
        this._motionState.velocityAnimationVelocity = 0;
        this._motionState.constraintAnimationVelocity = 0;
        // Start an edit.
        beginEdit();
        // If we've hit any constraint then apply that.
        var position = this._motionState.dragStart + this._motionState.dragDelta;
        if (this._hitConstraint) {
            // Push the current value into the system so that we can extract the delta.
            this._solver.suggestValue(this._variable, position);

            var violationDelta = this._hitConstraint.delta() / this._constraintCoefficient;

            position += violationDelta * this._hitConstraint.overdragCoefficient;
        }
        // Now tell the solver.
        this._solver.suggestValue(this._variable, position);
    } else if (this._motionState.constraintAnimation) {
        this._cancelAnimation('velocityAnimation');
        beginEdit();
        var position = this._motionState.constraintAnimationPosition;
        this._solver.suggestValue(this._variable, position);
        // If we're no longer in violation then we can kill the constraint animation and
        // create a new velocity animation unless our constraint is captive (in which case
        // we remain captured).
        if (!this._motionState.constraintAnimationConstraint.captive && this._motionState.constraintAnimationConstraint.delta() == 0) {
            var velocity = this._motionState.constraintAnimationVelocity;
            this._createAnimation(velocity);
        }
    } else if (this._motionState.velocityAnimation) {
        beginEdit();
        var position = this._motionState.velocityAnimationPosition;
        // We don't consider constraints here; we deal with them in didHitConstraint.
        this._solver.suggestValue(this._variable, position);
    } else {
        // We're not doing anything; end the edit.
        if (!this._motionState.editing) return;
        this._solver.endEdit(this._variable);
        this._motionState.editing = false;
        this._motionState.velocityAnimationVelocity = 0;
        this._motionState.constraintAnimationVelocity = 0;
    }
    if (this._motionContext) this._motionContext.update();
}
Manipulator.prototype._createAnimation = function(velocity) {
    // Can't animate if we're being dragged.
    if (this._motionState.dragging) return;

    var self = this;

    function sign(x) {
        return typeof x === 'number' ? x ? x < 0 ? -1 : 1 : x === x ? 0 : NaN : NaN;
    }
    // Create an animation from where we are. This is either just a regular motion or we're
    // violating a constraint and we need to animate out of violation.
    if (this._hitConstraint) {
        // Don't interrupt an animation caused by a constraint to enforce the same constraint.
        // This can happen if the constraint is enforced by an underdamped spring, for example.
        if (this._motionState.constraintAnimation) {
            if (this._motionState.constraintAnimationConstraint == this._hitConstraint || this._motionState.constraintAnimationConstraint.captive)
                return;
            this._cancelAnimation('constraintAnimation');
        }

        this._motionState.constraintAnimationConstraint = this._hitConstraint;

        // Determine the current velocity and end point if no constraint had been hit. Some
        // discontinuous constraint ops use this to determine which point they're going to snap to.
        velocity = self._motionState.velocityAnimation ? self._motionState.velocityAnimationVelocity : velocity;
        var endPosition = this._variable.valueOf();
        if (self._motionState.velocityAnimation) endPosition = self._motionState.velocityAnimation.model.x(60);
        else if (velocity) {
            var motion = this.createMotion(this._variable.valueOf(), velocity);
            endPosition = motion.x(60);
        }
        var startPosition = this._motionState.dragStart;
        // If the constraint isn't relative to our variable then we need to use the solver to
        // get the appropriate startPosition and endPosition.
        if (this._variable != this._hitConstraint.variable) {
            var original = this._variable.valueOf();
            if (this._motionState.editing) {
                this._solver.suggestValue(this._variable, startPosition);
                this._solver.solve();
                startPosition = this._hitConstraint.variable.valueOf();

                this._solver.suggestValue(this._variable, endPosition);
                this._solver.solve();
                endPosition = this._hitConstraint.variable.valueOf();

                this._solver.suggestValue(this._variable, original);
                this._solver.solve();
            } else {
                // XXX: Should start a temporary edit to avoid this...
                console.warn('not editing; cannot figure out correct start/end positions for motion constraint');
            }
        }

        // We pass through the "natural" end point and the start position. MotionConstraints
        // shouldn't need velocity, so we don't pass that through. (Perhaps there's a constraint
        // that does need it, then I'll put it back; haven't found that constraint yet).
        var delta = this._hitConstraint.delta(endPosition, startPosition);

        // Figure out how far we have to go to be out of violation. Because we use a linear
        // constraint solver to surface violations we only need to remember the coefficient
        // of a given violation.
        var violationDelta = delta / this._constraintCoefficient;

        // We always do the constraint animation when we've hit a constraint. If the constraint
        // isn't captive then we'll fall out of it and into a regular velocity animation later
        // on (this is how the ends of scroll springs work).
        this._cancelAnimation('constraintAnimation');
        this._cancelAnimation('velocityAnimation');
        var motion = this._hitConstraint.createMotion(this._variable.valueOf());
        motion.setEnd(this._variable.valueOf() + violationDelta, velocity);

        this._motionState.constraintAnimation = Gravitas.createAnimation(motion,
            function() {
                self._motionState.constraintAnimationPosition = motion.x();
                self._motionState.constraintAnimationVelocity = motion.dx(); // unused.
                self._update();

                if (motion.done()) {
                    self._cancelAnimation('constraintAnimation');
                    self._motionState.constraintAnimationConstraint = null;
                    self._update();
                }
            });
        return;
    }

    // No constraint violation, just a plain motion animation incorporating the velocity
    // imparted by the finger.
    var motion = this.createMotion(this._variable.valueOf(), velocity);

    if (motion.done()) return;

    this._cancelAnimation('velocityAnimation');
    this._cancelAnimation('constraintAnimation');
    
    this._motionState.velocityAnimation = Gravitas.createAnimation(motion,
        function() {
            self._motionState.velocityAnimationPosition = motion.x();
            self._motionState.velocityAnimationVelocity = motion.dx();
            self._update();
            // If we've hit the end then cancel ourselves and update the system
            // which will end the edit.
            if (motion.done()) {
                self._cancelAnimation('velocityAnimation');
                self._update();
                if (self._hitConstraint) self._createAnimation(0);
            }
        });
}
Manipulator.prototype.hitConstraint = function(constraint, coefficient, delta) {
    // XXX: Handle hitting multiple constraints.
    if (constraint == this._hitConstraint) return;
    this._hitConstraint = constraint;
    this._constraintCoefficient = coefficient;

    if (this._motionState.dragging) {
        this._update();
        return;
    }
    if (this._motionState.trialAnimation)
        return;
    this._createAnimation();
}
Manipulator.prototype.hitConstraints = function(violations) {
    // XXX: Do something good here instead.
    //
    // Sort the violations by the largest delta and then just handle that one.
    if (violations.length == 0) {
        this._hitConstraint = null;
        this._constraintCoefficient = 1;
        return;
    }
    violations.sort(function(a, b) {
        var amc = a.motionConstraint;
        var bmc = b.motionConstraint;
        // Non animation-only constraints are less important than animation only ones;
        // we should also sort on overdrag coefficient so that we get the tightest
        // constraints to the top.
        if (amc.overdragCoefficient == bmc.overdragCoefficient)
            return Math.abs(b.delta) - Math.abs(a.delta);
        return (bmc.overdragCoefficient - amc.overdragCoefficient);
    });
    this.hitConstraint(violations[0].motionConstraint, violations[0].coefficient, violations[0].delta);
}
Manipulator.prototype.animating = function() {
    if (this._motionState.dragging) return false;
    return !!this._motionState.velocityAnimation || this._motionState.trialAnimation;
}
Manipulator.prototype.editing = function() { return this._motionState.editing; }
Manipulator.prototype.cancelAnimations = function() {
    this._cancelAnimation('velocityAnimation');
    this._cancelAnimation('constraintAnimation');
    this._hitConstraint = null; // XXX: Hacky -- want to prevent starting a new constraint animation in update; just want it to end the edit.
    this._update();
}

module.exports = Manipulator;

},{}],3:[function(require,module,exports){
'use strict';

// Motion constraint definition

// These are the ops; they return the delta when not met.
var ops = {
    greater: function(a, b) {
            if (a >= b) return 0;
            return b - a;
        },
    less: function(a, b) {
        if (a <= b) return 0;
        return b - a;
    },
    l: function(a, b) {
        if (a < b) return 0;
        return b - a;
    },
    g: function(a, b) {
        if (a > b) return 0;
        return b - a;
    },
    equal: function(a, b) { return b - a; },
    modulo: function(a, b, naturalEndPosition) {
        var nearest = b * Math.round(naturalEndPosition/b);
        return nearest - a;
    },
    // Like modulo, but only snaps to the current or adjacent values. Really good for pagers.
    adjacentModulo: function(a, b, naturalEndPosition, gestureStartPosition) {
        if (gestureStartPosition === undefined) return ops.modulo(a, b, naturalEndPosition);

        var startNearest = Math.round(gestureStartPosition/b);
        var endNearest = Math.round(naturalEndPosition/b);

        var difference = endNearest - startNearest;

        // Make the difference at most 1, so that we're only going to adjacent snap points.
        if (difference) difference /= Math.abs(difference);

        var nearest = (startNearest + difference) * b;

        return nearest - a;
    },
    or: function(a, b, naturalEndPosition) {
        // From ES6, not in Safari yet.
        var MAX_SAFE_INTEGER = 9007199254740991;
        // Like modulo, but just finds the nearest in the array b.
        if (!Array.isArray(b)) return 0;
        var distance = MAX_SAFE_INTEGER;
        var nearest = naturalEndPosition;

        for (var i = 0; i < b.length; i++) {
            var dist = Math.abs(b[i] - naturalEndPosition);
            if (dist > distance) continue;
            distance = dist;
            nearest = b[i];
        }

        return nearest - a;
    }
};

function MotionConstraint(variable, op, value, options) {
    this.variable = variable;
    this.value = value;
    if (typeof op === 'string') {
        switch (op) {
        case '==': this.op = ops.equal; break;
        case '>=': this.op = ops.greater; break;
        case '<=': this.op = ops.less; break;
        case '<': this.op = ops.l; break;
        case '>': this.op = ops.g; break;
        case '%': this.op = ops.modulo; break;
        case '||': this.op = ops.or; break;
        }
    } else {
        this.op = op;
    }
    if (!options) options = {};
    this.overdragCoefficient = options.hasOwnProperty('overdragCoefficient') ? options.overdragCoefficient : 0.75;
    this.physicsModel = options.physicsModel;
    this.captive = options.captive || false;
}
// Some random physics models to use in options. Not sure these belong here.
MotionConstraint.underDamped = function() { return new Gravitas.Spring(1, 200, 20); }
MotionConstraint.criticallyDamped = function() { return new Gravitas.Spring(1, 200, Math.sqrt(4 * 1 * 200)); }
MotionConstraint.ops = ops;
MotionConstraint.prototype.delta = function(naturalEndPosition, gestureStartPosition) {
    if (!naturalEndPosition) naturalEndPosition = this.variable;

    return this.op(this.variable, this.value, naturalEndPosition, gestureStartPosition);
}
MotionConstraint.prototype.createMotion = function(startPosition) {
    var motion = this.physicsModel ? this.physicsModel() : new Gravitas.Spring(1, 200, 20);//Math.sqrt(200 * 4));
    motion.snap(startPosition);
    return motion;
}

module.exports = MotionConstraint;

},{}],4:[function(require,module,exports){
'use strict';

var MultiEditSolver = require('./MultiEditSolver.js');

// This object updates all of the boxes from the constraint solver. It also tests
// all of the motion constraints and identifies which manipulator caused a motion
// constraint to be violated.
function MotionContext() {
    this._solver = new MultiEditSolver(new c.SimplexSolver());
    this._boxes = [];
    this._motionConstraints = [];
    this._manipulators = [];
    this._updating = false;
}
MotionContext.prototype.solver = function() { return this._solver; }
MotionContext.prototype.addBox = function(box) {
    this._boxes.push(box);
}
MotionContext.prototype.boxes = function() { return this._boxes; }
MotionContext.prototype.addMotionConstraint = function(motionConstraint) {
    this._motionConstraints.push(motionConstraint);
    return motionConstraint;
}
MotionContext.prototype.addManipulator = function(manipulator) {
    this._manipulators.push(manipulator);
    manipulator._setMotionContext(this);
    this.update(); // XXX: Remove -- constructing a Manipulator used to do this, moved it here but it should go.
    return manipulator;
}
MotionContext.prototype.update = function() {
    // Prevent re-entrancy which can happen when a motion constraint violation
    // causes an animation to be created which propagates another update.
    if (this._updating) return;
    this._updating = true;
    this._resolveMotionConstraints();
    for (var i = 0; i < this._boxes.length; i++) {
        this._boxes[i].update();
    }
    this._updating = false;
}
// Find out how a manipulator is related to a variable.
MotionContext.prototype._coefficient = function(manipulator, variable) {
    var solver = this._solver.solver();
    var v = manipulator.variable();
    // Iterate the edit variables in the solver. XXX: these are private and we need a real interface soon.
    var editVarInfo = solver._editVarMap.get(v);
    // No edit variable? No contribution to the current violation.
    if (!editVarInfo) return 0;
    // Now we can ask the coefficient of the edit's minus variable to the manipulator's variable. This
    // is what the solver does in suggestValue.
    var editMinus = editVarInfo.editMinus;
    // Get the expression that corresponds to the motion constraint's violated variable.
    // This is probably an "external variable" in cassowary.
    var expr = solver.rows.get(variable);
    if (!expr) return 0;
    // Finally we can compute the value.
    return expr.coefficientFor(editMinus);
}
MotionContext.prototype._resolveMotionConstraints = function() {
    var allViolations = {};

    // We want to call all manipulators so that those that previously were violating but now
    // are not get those violations removed.
    for (var i = 0; i < this._manipulators.length; i++) {
        var manipulator = this._manipulators[i];
        allViolations[manipulator.name()] = { manipulator: manipulator, violations: [] };
    }

    function addViolation(manipulator, motionConstraint, coefficient, delta) {
        var record = { motionConstraint: motionConstraint, coefficient: coefficient, delta: delta };
        var name = manipulator.name();
        if (!allViolations.hasOwnProperty(name)) {
            allViolations[name] = { manipulator: manipulator, violations: [record] };
        } else {
            allViolations[name].violations.push(record);
        }
    }
    function dispatchViolations() {
        for (var k in allViolations) {
            var info = allViolations[k];
            info.manipulator.hitConstraints(info.violations);
        }
    }

    for (var i = 0; i < this._motionConstraints.length; i++) {
        var pc = this._motionConstraints[i];
        var delta = pc.delta();
        if (delta == 0)
            continue;

        // Notify the manipulators that contributed to this violation.
        for (var j = 0; j < this._manipulators.length; j++) {
            var manipulator = this._manipulators[j];
            
            // If there's no delta and the manipulator isn't animating then it isn't a violation we want to deal
            // with now.
            if (delta == 0) continue;

            var c = this._coefficient(manipulator, pc.variable);

            // Do nothing if they're unrelated (i.e.: the coefficient is zero; this manipulator doesn't contribute).
            if (c == 0) continue;

            // We found a violation and the manipulator that contributed. Remember it and we'll
            // tell the manipulator about all the violations it contributed to at once afterwards
            // and it can decide what it's going to do about it...
            addViolation(manipulator, pc, c, delta);
        }
        // XXX: We should find ONE manipulator, or figure out which manipulator to target in the
        //      case of multiple. If we have one doing an animation, and one doing a touch drag
        //      then maybe we want to constrain the animating manipulator and let the touch one
        //      ride?
    }
    // Tell all the manipulators that we're done constraining.
    dispatchViolations();
}
MotionContext.prototype.stopOthers = function(variable) {
    // Kill all the manipulators that are animating this variable. There's a new touch point
    // that's now dominant.
    for (var i = 0; i < this._manipulators.length; i++) {
        var manipulator = this._manipulators[i];
        if (this._coefficient(manipulator, variable) != 0) manipulator.cancelAnimations();
    }
}

module.exports = MotionContext;

},{"./MultiEditSolver.js":5}],5:[function(require,module,exports){
"use strict";

// Wrap the cassowary solver so that multiple clients can begin and end edits without conflicting.
// We do this by ending an edit session whenever we need to add or remove a variable from the current
// edit and then starting a new one and pushing all of the same suggestions back in.
function MultiEditSolver(solver) {
    this._solver = solver;
    this._editing = false;
    this._editVars = [];

    // More recent edits get a higher priority.
    this._priority = 0;

    // Hacky; figure out what the real API here is.
    this.add = this._solver.add.bind(this._solver);
    this.solve = this._solver.solve.bind(this._solver);
    this.resolve = this._solver.resolve.bind(this._solver);
    this.addConstraint = this._solver.addConstraint.bind(this._solver);
    this.removeConstraint = this._solver.removeConstraint.bind(this._solver);
}
MultiEditSolver.prototype.solver = function() { return this._solver; }
MultiEditSolver.prototype.beginEdit = function(variable, strength) {
    var idx = this._find(variable);
    if (idx != -1) {
        this._editVars[idx].count++;
        console.log('multiple edit sessions on ' + variable.name);
        return;
    }

    this._editVars.push({ edit: variable, strength: strength, priority: this._priority++, suggest: null, count: 1 });
    this._reedit();
}
MultiEditSolver.prototype._find = function(variable) {
    for (var i = 0; i < this._editVars.length; i++) {
        if (this._editVars[i].edit === variable) {
            return i;
        }
    }
    return -1;
}
MultiEditSolver.prototype.endEdit = function(variable) {
    var idx = this._find(variable);
    if (idx == -1) {
        console.warn('cannot end edit on variable that is not being edited');
        return;
    }
    this._editVars[idx].count--;
    if (this._editVars[idx].count == 0) {
        this._editVars.splice(idx, 1);
        this._reedit();
    }
}
MultiEditSolver.prototype.suggestValue = function(variable, value) {
    if (!this._editing) {
        console.warn('cannot suggest value when not editing');
        return;
    }
    var idx = this._find(variable);
    if (idx == -1) {
        console.warn('cannot suggest value for variable that we are not editing');
        return;
    }
    this._editVars[idx].suggest = value;
    this._solver.suggestValue(variable, value).resolve();
}
MultiEditSolver.prototype._reedit = function() {
    if (this._editing) {
        this._solver.endEdit();
        this._solver.removeAllEditVars();
    }
    this._editing = false;

    if (this._editVars.length == 0) {
        this._solver.resolve();
        return;
    }
    
    for (var i = 0; i < this._editVars.length; i++) {
        var v = this._editVars[i];

        this._solver.addEditVar(v.edit, v.strength, v.priority);
    }

    this._solver.beginEdit();

    // Now suggest all of the previous values again. Not sure if doing them
    // in a different order will cause a different outcome...
    for (var i = 0; i < this._editVars.length; i++) {
        var v = this._editVars[i];

        if (!v.suggest) continue;

        this._solver.suggestValue(v.edit, v.suggest);
    }

    // Finally resolve.
    this._solver.resolve();
    this._editing = true;
}

module.exports = MultiEditSolver;

},{}],6:[function(require,module,exports){
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
        if (name.indexOf('_') == -1) {
            vars[name] = new c.Variable({name: name});
            return vars[name];
        }
        var bits = name.split('_', 2);
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
        var r = c.parser.parse(desc.constraints[i]);
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

},{"./Box.js":1,"./Manipulator.js":2,"./MotionConstraint.js":3,"./MotionContext.js":4}],7:[function(require,module,exports){
'use strict';

var Slalom = {
    MotionContext: require('./MotionContext.js'),
    Manipulator: require('./Manipulator.js'),
    MotionConstraint: require('./MotionConstraint.js'),
    Box: require('./Box.js'),
    Serialization: require('./Serialization.js'),
};

module.exports = Slalom;

},{"./Box.js":1,"./Manipulator.js":2,"./MotionConstraint.js":3,"./MotionContext.js":4,"./Serialization.js":6}]},{},[7])(7)
});