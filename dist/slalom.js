(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define(factory);
	else if(typeof exports === 'object')
		exports["Slalom"] = factory();
	else
		root["Slalom"] = factory();
})(this, function() {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;
/******/ 		
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};
/******/ 		
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 		
/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;
/******/ 		
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/******/ 	
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/ 	
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/ 	
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/ 	
/******/ 	
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var Slalom = {
	    MotionContext: __webpack_require__(4),
	    Manipulator: __webpack_require__(2),
	    MotionConstraint: __webpack_require__(3),
	    Box: __webpack_require__(1),
	    Serialization: __webpack_require__(7),
	};

	module.exports = Slalom;


/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

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
	    this.layoutWidth = -1;
	    this.layoutHeight = -1;

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

	    if (this.layoutWidth != -1) {
	        xscale = w / this.layoutWidth;
	        w = this.layoutWidth;
	    }
	    if (this.layoutHeight != -1) {
	        yscale = h / this.layoutHeight;
	        h = this.layoutHeight;
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



/***/ },
/* 2 */
/***/ function(module, exports, __webpack_require__) {

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


/***/ },
/* 3 */
/***/ function(module, exports, __webpack_require__) {

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


/***/ },
/* 4 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var MultiEditSolver = __webpack_require__(6);

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


/***/ },
/* 5 */
/***/ function(module, exports, __webpack_require__) {

	module.exports = (function() {
	  /*
	   * Generated by PEG.js 0.8.0.
	   *
	   * http://pegjs.majda.cz/
	   */

	  function peg$subclass(child, parent) {
	    function ctor() { this.constructor = child; }
	    ctor.prototype = parent.prototype;
	    child.prototype = new ctor();
	  }

	  function SyntaxError(message, expected, found, offset, line, column) {
	    this.message  = message;
	    this.expected = expected;
	    this.found    = found;
	    this.offset   = offset;
	    this.line     = line;
	    this.column   = column;

	    this.name     = "SyntaxError";
	  }

	  peg$subclass(SyntaxError, Error);

	  function parse(input) {
	    var options = arguments.length > 1 ? arguments[1] : {},

	        peg$FAILED = {},

	        peg$startRuleFunctions = { start: peg$parsestart },
	        peg$startRuleFunction  = peg$parsestart,

	        peg$c0 = peg$FAILED,
	        peg$c1 = [],
	        peg$c2 = function(statements) { return statements; },
	        peg$c3 = function(expression) { return expression; },
	        peg$c4 = { type: "any", description: "any character" },
	        peg$c5 = /^[a-zA-Z]/,
	        peg$c6 = { type: "class", value: "[a-zA-Z]", description: "[a-zA-Z]" },
	        peg$c7 = "$",
	        peg$c8 = { type: "literal", value: "$", description: "\"$\"" },
	        peg$c9 = "_",
	        peg$c10 = { type: "literal", value: "_", description: "\"_\"" },
	        peg$c11 = ".",
	        peg$c12 = { type: "literal", value: ".", description: "\".\"" },
	        peg$c13 = { type: "other", description: "whitespace" },
	        peg$c14 = /^[\t\x0B\f \xA0\uFEFF]/,
	        peg$c15 = { type: "class", value: "[\\t\\x0B\\f \\xA0\\uFEFF]", description: "[\\t\\x0B\\f \\xA0\\uFEFF]" },
	        peg$c16 = /^[\n\r\u2028\u2029]/,
	        peg$c17 = { type: "class", value: "[\\n\\r\\u2028\\u2029]", description: "[\\n\\r\\u2028\\u2029]" },
	        peg$c18 = { type: "other", description: "end of line" },
	        peg$c19 = "\n",
	        peg$c20 = { type: "literal", value: "\n", description: "\"\\n\"" },
	        peg$c21 = "\r\n",
	        peg$c22 = { type: "literal", value: "\r\n", description: "\"\\r\\n\"" },
	        peg$c23 = "\r",
	        peg$c24 = { type: "literal", value: "\r", description: "\"\\r\"" },
	        peg$c25 = "\u2028",
	        peg$c26 = { type: "literal", value: "\u2028", description: "\"\\u2028\"" },
	        peg$c27 = "\u2029",
	        peg$c28 = { type: "literal", value: "\u2029", description: "\"\\u2029\"" },
	        peg$c29 = ";",
	        peg$c30 = { type: "literal", value: ";", description: "\";\"" },
	        peg$c31 = void 0,
	        peg$c32 = { type: "other", description: "comment" },
	        peg$c33 = "/*",
	        peg$c34 = { type: "literal", value: "/*", description: "\"/*\"" },
	        peg$c35 = "*/",
	        peg$c36 = { type: "literal", value: "*/", description: "\"*/\"" },
	        peg$c37 = "//",
	        peg$c38 = { type: "literal", value: "//", description: "\"//\"" },
	        peg$c39 = function(val) {
	            return {
	              type: "NumericLiteral",
	              value: val
	            }
	          },
	        peg$c40 = /^[0-9]/,
	        peg$c41 = { type: "class", value: "[0-9]", description: "[0-9]" },
	        peg$c42 = function(digits) {
	            return parseInt(digits.join(""));
	          },
	        peg$c43 = function(digits) {
	            return parseFloat(digits.join(""));
	          },
	        peg$c44 = null,
	        peg$c45 = /^[\-+]/,
	        peg$c46 = { type: "class", value: "[\\-+]", description: "[\\-+]" },
	        peg$c47 = { type: "other", description: "identifier" },
	        peg$c48 = function(name) { return name; },
	        peg$c49 = function(start, parts) {
	              return start + parts.join("");
	            },
	        peg$c50 = function(name) { return { type: "Variable", name: name }; },
	        peg$c51 = "(",
	        peg$c52 = { type: "literal", value: "(", description: "\"(\"" },
	        peg$c53 = ")",
	        peg$c54 = { type: "literal", value: ")", description: "\")\"" },
	        peg$c55 = function(operator, expression) {
	              return {
	                type:       "UnaryExpression",
	                operator:   operator,
	                expression: expression
	              };
	            },
	        peg$c56 = "+",
	        peg$c57 = { type: "literal", value: "+", description: "\"+\"" },
	        peg$c58 = "-",
	        peg$c59 = { type: "literal", value: "-", description: "\"-\"" },
	        peg$c60 = "!",
	        peg$c61 = { type: "literal", value: "!", description: "\"!\"" },
	        peg$c62 = function(head, tail) {
	              var result = head;
	              for (var i = 0; i < tail.length; i++) {
	                result = {
	                  type:     "MultiplicativeExpression",
	                  operator: tail[i][1],
	                  left:     result,
	                  right:    tail[i][3]
	                };
	              }
	              return result;
	            },
	        peg$c63 = "*",
	        peg$c64 = { type: "literal", value: "*", description: "\"*\"" },
	        peg$c65 = "/",
	        peg$c66 = { type: "literal", value: "/", description: "\"/\"" },
	        peg$c67 = function(head, tail) {
	              var result = head;
	              for (var i = 0; i < tail.length; i++) {
	                result = {
	                  type:     "AdditiveExpression",
	                  operator: tail[i][1],
	                  left:     result,
	                  right:    tail[i][3]
	                };
	              }
	              return result;
	            },
	        peg$c68 = function(head, tail) {
	              var result = head;
	              for (var i = 0; i < tail.length; i++) {
	                result = {
	                  type:     "Inequality",
	                  operator: tail[i][1],
	                  left:     result,
	                  right:    tail[i][3],
	                  strength: tail[i][4]
	                };
	              }
	              return result;
	            },
	        peg$c69 = "<=",
	        peg$c70 = { type: "literal", value: "<=", description: "\"<=\"" },
	        peg$c71 = ">=",
	        peg$c72 = { type: "literal", value: ">=", description: "\">=\"" },
	        peg$c73 = "<",
	        peg$c74 = { type: "literal", value: "<", description: "\"<\"" },
	        peg$c75 = ">",
	        peg$c76 = { type: "literal", value: ">", description: "\">\"" },
	        peg$c77 = "!required",
	        peg$c78 = { type: "literal", value: "!required", description: "\"!required\"" },
	        peg$c79 = "!strong",
	        peg$c80 = { type: "literal", value: "!strong", description: "\"!strong\"" },
	        peg$c81 = "!medium",
	        peg$c82 = { type: "literal", value: "!medium", description: "\"!medium\"" },
	        peg$c83 = "!weak",
	        peg$c84 = { type: "literal", value: "!weak", description: "\"!weak\"" },
	        peg$c85 = function(strength) { return strength; },
	        peg$c86 = "==",
	        peg$c87 = { type: "literal", value: "==", description: "\"==\"" },
	        peg$c88 = function(head, tail) {
	              var result = head;
	              for (var i = 0; i < tail.length; i++) {
	                result = {
	                  type:     "Equality",
	                  operator: tail[i][1],
	                  left:     result,
	                  right:    tail[i][3],
	                  strength: tail[i][4]
	                };
	              }
	              return result;
	            },

	        peg$currPos          = 0,
	        peg$reportedPos      = 0,
	        peg$cachedPos        = 0,
	        peg$cachedPosDetails = { line: 1, column: 1, seenCR: false },
	        peg$maxFailPos       = 0,
	        peg$maxFailExpected  = [],
	        peg$silentFails      = 0,

	        peg$result;

	    if ("startRule" in options) {
	      if (!(options.startRule in peg$startRuleFunctions)) {
	        throw new Error("Can't start parsing from rule \"" + options.startRule + "\".");
	      }

	      peg$startRuleFunction = peg$startRuleFunctions[options.startRule];
	    }

	    function text() {
	      return input.substring(peg$reportedPos, peg$currPos);
	    }

	    function offset() {
	      return peg$reportedPos;
	    }

	    function line() {
	      return peg$computePosDetails(peg$reportedPos).line;
	    }

	    function column() {
	      return peg$computePosDetails(peg$reportedPos).column;
	    }

	    function expected(description) {
	      throw peg$buildException(
	        null,
	        [{ type: "other", description: description }],
	        peg$reportedPos
	      );
	    }

	    function error(message) {
	      throw peg$buildException(message, null, peg$reportedPos);
	    }

	    function peg$computePosDetails(pos) {
	      function advance(details, startPos, endPos) {
	        var p, ch;

	        for (p = startPos; p < endPos; p++) {
	          ch = input.charAt(p);
	          if (ch === "\n") {
	            if (!details.seenCR) { details.line++; }
	            details.column = 1;
	            details.seenCR = false;
	          } else if (ch === "\r" || ch === "\u2028" || ch === "\u2029") {
	            details.line++;
	            details.column = 1;
	            details.seenCR = true;
	          } else {
	            details.column++;
	            details.seenCR = false;
	          }
	        }
	      }

	      if (peg$cachedPos !== pos) {
	        if (peg$cachedPos > pos) {
	          peg$cachedPos = 0;
	          peg$cachedPosDetails = { line: 1, column: 1, seenCR: false };
	        }
	        advance(peg$cachedPosDetails, peg$cachedPos, pos);
	        peg$cachedPos = pos;
	      }

	      return peg$cachedPosDetails;
	    }

	    function peg$fail(expected) {
	      if (peg$currPos < peg$maxFailPos) { return; }

	      if (peg$currPos > peg$maxFailPos) {
	        peg$maxFailPos = peg$currPos;
	        peg$maxFailExpected = [];
	      }

	      peg$maxFailExpected.push(expected);
	    }

	    function peg$buildException(message, expected, pos) {
	      function cleanupExpected(expected) {
	        var i = 1;

	        expected.sort(function(a, b) {
	          if (a.description < b.description) {
	            return -1;
	          } else if (a.description > b.description) {
	            return 1;
	          } else {
	            return 0;
	          }
	        });

	        while (i < expected.length) {
	          if (expected[i - 1] === expected[i]) {
	            expected.splice(i, 1);
	          } else {
	            i++;
	          }
	        }
	      }

	      function buildMessage(expected, found) {
	        function stringEscape(s) {
	          function hex(ch) { return ch.charCodeAt(0).toString(16).toUpperCase(); }

	          return s
	            .replace(/\\/g,   '\\\\')
	            .replace(/"/g,    '\\"')
	            .replace(/\x08/g, '\\b')
	            .replace(/\t/g,   '\\t')
	            .replace(/\n/g,   '\\n')
	            .replace(/\f/g,   '\\f')
	            .replace(/\r/g,   '\\r')
	            .replace(/[\x00-\x07\x0B\x0E\x0F]/g, function(ch) { return '\\x0' + hex(ch); })
	            .replace(/[\x10-\x1F\x80-\xFF]/g,    function(ch) { return '\\x'  + hex(ch); })
	            .replace(/[\u0180-\u0FFF]/g,         function(ch) { return '\\u0' + hex(ch); })
	            .replace(/[\u1080-\uFFFF]/g,         function(ch) { return '\\u'  + hex(ch); });
	        }

	        var expectedDescs = new Array(expected.length),
	            expectedDesc, foundDesc, i;

	        for (i = 0; i < expected.length; i++) {
	          expectedDescs[i] = expected[i].description;
	        }

	        expectedDesc = expected.length > 1
	          ? expectedDescs.slice(0, -1).join(", ")
	              + " or "
	              + expectedDescs[expected.length - 1]
	          : expectedDescs[0];

	        foundDesc = found ? "\"" + stringEscape(found) + "\"" : "end of input";

	        return "Expected " + expectedDesc + " but " + foundDesc + " found.";
	      }

	      var posDetails = peg$computePosDetails(pos),
	          found      = pos < input.length ? input.charAt(pos) : null;

	      if (expected !== null) {
	        cleanupExpected(expected);
	      }

	      return new SyntaxError(
	        message !== null ? message : buildMessage(expected, found),
	        expected,
	        found,
	        pos,
	        posDetails.line,
	        posDetails.column
	      );
	    }

	    function peg$parsestart() {
	      var s0, s1, s2, s3;

	      s0 = peg$currPos;
	      s1 = peg$parse__();
	      if (s1 !== peg$FAILED) {
	        s2 = [];
	        s3 = peg$parseStatement();
	        while (s3 !== peg$FAILED) {
	          s2.push(s3);
	          s3 = peg$parseStatement();
	        }
	        if (s2 !== peg$FAILED) {
	          s3 = peg$parse__();
	          if (s3 !== peg$FAILED) {
	            peg$reportedPos = s0;
	            s1 = peg$c2(s2);
	            s0 = s1;
	          } else {
	            peg$currPos = s0;
	            s0 = peg$c0;
	          }
	        } else {
	          peg$currPos = s0;
	          s0 = peg$c0;
	        }
	      } else {
	        peg$currPos = s0;
	        s0 = peg$c0;
	      }

	      return s0;
	    }

	    function peg$parseStatement() {
	      var s0, s1, s2;

	      s0 = peg$currPos;
	      s1 = peg$parseLinearExpression();
	      if (s1 !== peg$FAILED) {
	        s2 = peg$parseEOS();
	        if (s2 !== peg$FAILED) {
	          peg$reportedPos = s0;
	          s1 = peg$c3(s1);
	          s0 = s1;
	        } else {
	          peg$currPos = s0;
	          s0 = peg$c0;
	        }
	      } else {
	        peg$currPos = s0;
	        s0 = peg$c0;
	      }

	      return s0;
	    }

	    function peg$parseSourceCharacter() {
	      var s0;

	      if (input.length > peg$currPos) {
	        s0 = input.charAt(peg$currPos);
	        peg$currPos++;
	      } else {
	        s0 = peg$FAILED;
	        if (peg$silentFails === 0) { peg$fail(peg$c4); }
	      }

	      return s0;
	    }

	    function peg$parseIdentifierStart() {
	      var s0;

	      if (peg$c5.test(input.charAt(peg$currPos))) {
	        s0 = input.charAt(peg$currPos);
	        peg$currPos++;
	      } else {
	        s0 = peg$FAILED;
	        if (peg$silentFails === 0) { peg$fail(peg$c6); }
	      }
	      if (s0 === peg$FAILED) {
	        if (input.charCodeAt(peg$currPos) === 36) {
	          s0 = peg$c7;
	          peg$currPos++;
	        } else {
	          s0 = peg$FAILED;
	          if (peg$silentFails === 0) { peg$fail(peg$c8); }
	        }
	        if (s0 === peg$FAILED) {
	          if (input.charCodeAt(peg$currPos) === 95) {
	            s0 = peg$c9;
	            peg$currPos++;
	          } else {
	            s0 = peg$FAILED;
	            if (peg$silentFails === 0) { peg$fail(peg$c10); }
	          }
	        }
	      }

	      return s0;
	    }

	    function peg$parseIdentifierPart() {
	      var s0;

	      s0 = peg$parseIdentifierStart();
	      if (s0 === peg$FAILED) {
	        if (input.charCodeAt(peg$currPos) === 46) {
	          s0 = peg$c11;
	          peg$currPos++;
	        } else {
	          s0 = peg$FAILED;
	          if (peg$silentFails === 0) { peg$fail(peg$c12); }
	        }
	      }

	      return s0;
	    }

	    function peg$parseWhiteSpace() {
	      var s0, s1;

	      peg$silentFails++;
	      if (peg$c14.test(input.charAt(peg$currPos))) {
	        s0 = input.charAt(peg$currPos);
	        peg$currPos++;
	      } else {
	        s0 = peg$FAILED;
	        if (peg$silentFails === 0) { peg$fail(peg$c15); }
	      }
	      peg$silentFails--;
	      if (s0 === peg$FAILED) {
	        s1 = peg$FAILED;
	        if (peg$silentFails === 0) { peg$fail(peg$c13); }
	      }

	      return s0;
	    }

	    function peg$parseLineTerminator() {
	      var s0;

	      if (peg$c16.test(input.charAt(peg$currPos))) {
	        s0 = input.charAt(peg$currPos);
	        peg$currPos++;
	      } else {
	        s0 = peg$FAILED;
	        if (peg$silentFails === 0) { peg$fail(peg$c17); }
	      }

	      return s0;
	    }

	    function peg$parseLineTerminatorSequence() {
	      var s0, s1;

	      peg$silentFails++;
	      if (input.charCodeAt(peg$currPos) === 10) {
	        s0 = peg$c19;
	        peg$currPos++;
	      } else {
	        s0 = peg$FAILED;
	        if (peg$silentFails === 0) { peg$fail(peg$c20); }
	      }
	      if (s0 === peg$FAILED) {
	        if (input.substr(peg$currPos, 2) === peg$c21) {
	          s0 = peg$c21;
	          peg$currPos += 2;
	        } else {
	          s0 = peg$FAILED;
	          if (peg$silentFails === 0) { peg$fail(peg$c22); }
	        }
	        if (s0 === peg$FAILED) {
	          if (input.charCodeAt(peg$currPos) === 13) {
	            s0 = peg$c23;
	            peg$currPos++;
	          } else {
	            s0 = peg$FAILED;
	            if (peg$silentFails === 0) { peg$fail(peg$c24); }
	          }
	          if (s0 === peg$FAILED) {
	            if (input.charCodeAt(peg$currPos) === 8232) {
	              s0 = peg$c25;
	              peg$currPos++;
	            } else {
	              s0 = peg$FAILED;
	              if (peg$silentFails === 0) { peg$fail(peg$c26); }
	            }
	            if (s0 === peg$FAILED) {
	              if (input.charCodeAt(peg$currPos) === 8233) {
	                s0 = peg$c27;
	                peg$currPos++;
	              } else {
	                s0 = peg$FAILED;
	                if (peg$silentFails === 0) { peg$fail(peg$c28); }
	              }
	            }
	          }
	        }
	      }
	      peg$silentFails--;
	      if (s0 === peg$FAILED) {
	        s1 = peg$FAILED;
	        if (peg$silentFails === 0) { peg$fail(peg$c18); }
	      }

	      return s0;
	    }

	    function peg$parseEOS() {
	      var s0, s1, s2;

	      s0 = peg$currPos;
	      s1 = peg$parse__();
	      if (s1 !== peg$FAILED) {
	        if (input.charCodeAt(peg$currPos) === 59) {
	          s2 = peg$c29;
	          peg$currPos++;
	        } else {
	          s2 = peg$FAILED;
	          if (peg$silentFails === 0) { peg$fail(peg$c30); }
	        }
	        if (s2 !== peg$FAILED) {
	          s1 = [s1, s2];
	          s0 = s1;
	        } else {
	          peg$currPos = s0;
	          s0 = peg$c0;
	        }
	      } else {
	        peg$currPos = s0;
	        s0 = peg$c0;
	      }
	      if (s0 === peg$FAILED) {
	        s0 = peg$currPos;
	        s1 = peg$parse_();
	        if (s1 !== peg$FAILED) {
	          s2 = peg$parseLineTerminatorSequence();
	          if (s2 !== peg$FAILED) {
	            s1 = [s1, s2];
	            s0 = s1;
	          } else {
	            peg$currPos = s0;
	            s0 = peg$c0;
	          }
	        } else {
	          peg$currPos = s0;
	          s0 = peg$c0;
	        }
	        if (s0 === peg$FAILED) {
	          s0 = peg$currPos;
	          s1 = peg$parse__();
	          if (s1 !== peg$FAILED) {
	            s2 = peg$parseEOF();
	            if (s2 !== peg$FAILED) {
	              s1 = [s1, s2];
	              s0 = s1;
	            } else {
	              peg$currPos = s0;
	              s0 = peg$c0;
	            }
	          } else {
	            peg$currPos = s0;
	            s0 = peg$c0;
	          }
	        }
	      }

	      return s0;
	    }

	    function peg$parseEOF() {
	      var s0, s1;

	      s0 = peg$currPos;
	      peg$silentFails++;
	      if (input.length > peg$currPos) {
	        s1 = input.charAt(peg$currPos);
	        peg$currPos++;
	      } else {
	        s1 = peg$FAILED;
	        if (peg$silentFails === 0) { peg$fail(peg$c4); }
	      }
	      peg$silentFails--;
	      if (s1 === peg$FAILED) {
	        s0 = peg$c31;
	      } else {
	        peg$currPos = s0;
	        s0 = peg$c0;
	      }

	      return s0;
	    }

	    function peg$parseComment() {
	      var s0, s1;

	      peg$silentFails++;
	      s0 = peg$parseMultiLineComment();
	      if (s0 === peg$FAILED) {
	        s0 = peg$parseSingleLineComment();
	      }
	      peg$silentFails--;
	      if (s0 === peg$FAILED) {
	        s1 = peg$FAILED;
	        if (peg$silentFails === 0) { peg$fail(peg$c32); }
	      }

	      return s0;
	    }

	    function peg$parseMultiLineComment() {
	      var s0, s1, s2, s3, s4, s5;

	      s0 = peg$currPos;
	      if (input.substr(peg$currPos, 2) === peg$c33) {
	        s1 = peg$c33;
	        peg$currPos += 2;
	      } else {
	        s1 = peg$FAILED;
	        if (peg$silentFails === 0) { peg$fail(peg$c34); }
	      }
	      if (s1 !== peg$FAILED) {
	        s2 = [];
	        s3 = peg$currPos;
	        s4 = peg$currPos;
	        peg$silentFails++;
	        if (input.substr(peg$currPos, 2) === peg$c35) {
	          s5 = peg$c35;
	          peg$currPos += 2;
	        } else {
	          s5 = peg$FAILED;
	          if (peg$silentFails === 0) { peg$fail(peg$c36); }
	        }
	        peg$silentFails--;
	        if (s5 === peg$FAILED) {
	          s4 = peg$c31;
	        } else {
	          peg$currPos = s4;
	          s4 = peg$c0;
	        }
	        if (s4 !== peg$FAILED) {
	          s5 = peg$parseSourceCharacter();
	          if (s5 !== peg$FAILED) {
	            s4 = [s4, s5];
	            s3 = s4;
	          } else {
	            peg$currPos = s3;
	            s3 = peg$c0;
	          }
	        } else {
	          peg$currPos = s3;
	          s3 = peg$c0;
	        }
	        while (s3 !== peg$FAILED) {
	          s2.push(s3);
	          s3 = peg$currPos;
	          s4 = peg$currPos;
	          peg$silentFails++;
	          if (input.substr(peg$currPos, 2) === peg$c35) {
	            s5 = peg$c35;
	            peg$currPos += 2;
	          } else {
	            s5 = peg$FAILED;
	            if (peg$silentFails === 0) { peg$fail(peg$c36); }
	          }
	          peg$silentFails--;
	          if (s5 === peg$FAILED) {
	            s4 = peg$c31;
	          } else {
	            peg$currPos = s4;
	            s4 = peg$c0;
	          }
	          if (s4 !== peg$FAILED) {
	            s5 = peg$parseSourceCharacter();
	            if (s5 !== peg$FAILED) {
	              s4 = [s4, s5];
	              s3 = s4;
	            } else {
	              peg$currPos = s3;
	              s3 = peg$c0;
	            }
	          } else {
	            peg$currPos = s3;
	            s3 = peg$c0;
	          }
	        }
	        if (s2 !== peg$FAILED) {
	          if (input.substr(peg$currPos, 2) === peg$c35) {
	            s3 = peg$c35;
	            peg$currPos += 2;
	          } else {
	            s3 = peg$FAILED;
	            if (peg$silentFails === 0) { peg$fail(peg$c36); }
	          }
	          if (s3 !== peg$FAILED) {
	            s1 = [s1, s2, s3];
	            s0 = s1;
	          } else {
	            peg$currPos = s0;
	            s0 = peg$c0;
	          }
	        } else {
	          peg$currPos = s0;
	          s0 = peg$c0;
	        }
	      } else {
	        peg$currPos = s0;
	        s0 = peg$c0;
	      }

	      return s0;
	    }

	    function peg$parseMultiLineCommentNoLineTerminator() {
	      var s0, s1, s2, s3, s4, s5;

	      s0 = peg$currPos;
	      if (input.substr(peg$currPos, 2) === peg$c33) {
	        s1 = peg$c33;
	        peg$currPos += 2;
	      } else {
	        s1 = peg$FAILED;
	        if (peg$silentFails === 0) { peg$fail(peg$c34); }
	      }
	      if (s1 !== peg$FAILED) {
	        s2 = [];
	        s3 = peg$currPos;
	        s4 = peg$currPos;
	        peg$silentFails++;
	        if (input.substr(peg$currPos, 2) === peg$c35) {
	          s5 = peg$c35;
	          peg$currPos += 2;
	        } else {
	          s5 = peg$FAILED;
	          if (peg$silentFails === 0) { peg$fail(peg$c36); }
	        }
	        if (s5 === peg$FAILED) {
	          s5 = peg$parseLineTerminator();
	        }
	        peg$silentFails--;
	        if (s5 === peg$FAILED) {
	          s4 = peg$c31;
	        } else {
	          peg$currPos = s4;
	          s4 = peg$c0;
	        }
	        if (s4 !== peg$FAILED) {
	          s5 = peg$parseSourceCharacter();
	          if (s5 !== peg$FAILED) {
	            s4 = [s4, s5];
	            s3 = s4;
	          } else {
	            peg$currPos = s3;
	            s3 = peg$c0;
	          }
	        } else {
	          peg$currPos = s3;
	          s3 = peg$c0;
	        }
	        while (s3 !== peg$FAILED) {
	          s2.push(s3);
	          s3 = peg$currPos;
	          s4 = peg$currPos;
	          peg$silentFails++;
	          if (input.substr(peg$currPos, 2) === peg$c35) {
	            s5 = peg$c35;
	            peg$currPos += 2;
	          } else {
	            s5 = peg$FAILED;
	            if (peg$silentFails === 0) { peg$fail(peg$c36); }
	          }
	          if (s5 === peg$FAILED) {
	            s5 = peg$parseLineTerminator();
	          }
	          peg$silentFails--;
	          if (s5 === peg$FAILED) {
	            s4 = peg$c31;
	          } else {
	            peg$currPos = s4;
	            s4 = peg$c0;
	          }
	          if (s4 !== peg$FAILED) {
	            s5 = peg$parseSourceCharacter();
	            if (s5 !== peg$FAILED) {
	              s4 = [s4, s5];
	              s3 = s4;
	            } else {
	              peg$currPos = s3;
	              s3 = peg$c0;
	            }
	          } else {
	            peg$currPos = s3;
	            s3 = peg$c0;
	          }
	        }
	        if (s2 !== peg$FAILED) {
	          if (input.substr(peg$currPos, 2) === peg$c35) {
	            s3 = peg$c35;
	            peg$currPos += 2;
	          } else {
	            s3 = peg$FAILED;
	            if (peg$silentFails === 0) { peg$fail(peg$c36); }
	          }
	          if (s3 !== peg$FAILED) {
	            s1 = [s1, s2, s3];
	            s0 = s1;
	          } else {
	            peg$currPos = s0;
	            s0 = peg$c0;
	          }
	        } else {
	          peg$currPos = s0;
	          s0 = peg$c0;
	        }
	      } else {
	        peg$currPos = s0;
	        s0 = peg$c0;
	      }

	      return s0;
	    }

	    function peg$parseSingleLineComment() {
	      var s0, s1, s2, s3, s4, s5;

	      s0 = peg$currPos;
	      if (input.substr(peg$currPos, 2) === peg$c37) {
	        s1 = peg$c37;
	        peg$currPos += 2;
	      } else {
	        s1 = peg$FAILED;
	        if (peg$silentFails === 0) { peg$fail(peg$c38); }
	      }
	      if (s1 !== peg$FAILED) {
	        s2 = [];
	        s3 = peg$currPos;
	        s4 = peg$currPos;
	        peg$silentFails++;
	        s5 = peg$parseLineTerminator();
	        peg$silentFails--;
	        if (s5 === peg$FAILED) {
	          s4 = peg$c31;
	        } else {
	          peg$currPos = s4;
	          s4 = peg$c0;
	        }
	        if (s4 !== peg$FAILED) {
	          s5 = peg$parseSourceCharacter();
	          if (s5 !== peg$FAILED) {
	            s4 = [s4, s5];
	            s3 = s4;
	          } else {
	            peg$currPos = s3;
	            s3 = peg$c0;
	          }
	        } else {
	          peg$currPos = s3;
	          s3 = peg$c0;
	        }
	        while (s3 !== peg$FAILED) {
	          s2.push(s3);
	          s3 = peg$currPos;
	          s4 = peg$currPos;
	          peg$silentFails++;
	          s5 = peg$parseLineTerminator();
	          peg$silentFails--;
	          if (s5 === peg$FAILED) {
	            s4 = peg$c31;
	          } else {
	            peg$currPos = s4;
	            s4 = peg$c0;
	          }
	          if (s4 !== peg$FAILED) {
	            s5 = peg$parseSourceCharacter();
	            if (s5 !== peg$FAILED) {
	              s4 = [s4, s5];
	              s3 = s4;
	            } else {
	              peg$currPos = s3;
	              s3 = peg$c0;
	            }
	          } else {
	            peg$currPos = s3;
	            s3 = peg$c0;
	          }
	        }
	        if (s2 !== peg$FAILED) {
	          s3 = peg$parseLineTerminator();
	          if (s3 === peg$FAILED) {
	            s3 = peg$parseEOF();
	          }
	          if (s3 !== peg$FAILED) {
	            s1 = [s1, s2, s3];
	            s0 = s1;
	          } else {
	            peg$currPos = s0;
	            s0 = peg$c0;
	          }
	        } else {
	          peg$currPos = s0;
	          s0 = peg$c0;
	        }
	      } else {
	        peg$currPos = s0;
	        s0 = peg$c0;
	      }

	      return s0;
	    }

	    function peg$parse_() {
	      var s0, s1;

	      s0 = [];
	      s1 = peg$parseWhiteSpace();
	      if (s1 === peg$FAILED) {
	        s1 = peg$parseMultiLineCommentNoLineTerminator();
	        if (s1 === peg$FAILED) {
	          s1 = peg$parseSingleLineComment();
	        }
	      }
	      while (s1 !== peg$FAILED) {
	        s0.push(s1);
	        s1 = peg$parseWhiteSpace();
	        if (s1 === peg$FAILED) {
	          s1 = peg$parseMultiLineCommentNoLineTerminator();
	          if (s1 === peg$FAILED) {
	            s1 = peg$parseSingleLineComment();
	          }
	        }
	      }

	      return s0;
	    }

	    function peg$parse__() {
	      var s0, s1;

	      s0 = [];
	      s1 = peg$parseWhiteSpace();
	      if (s1 === peg$FAILED) {
	        s1 = peg$parseLineTerminatorSequence();
	        if (s1 === peg$FAILED) {
	          s1 = peg$parseComment();
	        }
	      }
	      while (s1 !== peg$FAILED) {
	        s0.push(s1);
	        s1 = peg$parseWhiteSpace();
	        if (s1 === peg$FAILED) {
	          s1 = peg$parseLineTerminatorSequence();
	          if (s1 === peg$FAILED) {
	            s1 = peg$parseComment();
	          }
	        }
	      }

	      return s0;
	    }

	    function peg$parseLiteral() {
	      var s0, s1;

	      s0 = peg$currPos;
	      s1 = peg$parseReal();
	      if (s1 === peg$FAILED) {
	        s1 = peg$parseInteger();
	      }
	      if (s1 !== peg$FAILED) {
	        peg$reportedPos = s0;
	        s1 = peg$c39(s1);
	      }
	      s0 = s1;

	      return s0;
	    }

	    function peg$parseInteger() {
	      var s0, s1, s2;

	      s0 = peg$currPos;
	      s1 = [];
	      if (peg$c40.test(input.charAt(peg$currPos))) {
	        s2 = input.charAt(peg$currPos);
	        peg$currPos++;
	      } else {
	        s2 = peg$FAILED;
	        if (peg$silentFails === 0) { peg$fail(peg$c41); }
	      }
	      if (s2 !== peg$FAILED) {
	        while (s2 !== peg$FAILED) {
	          s1.push(s2);
	          if (peg$c40.test(input.charAt(peg$currPos))) {
	            s2 = input.charAt(peg$currPos);
	            peg$currPos++;
	          } else {
	            s2 = peg$FAILED;
	            if (peg$silentFails === 0) { peg$fail(peg$c41); }
	          }
	        }
	      } else {
	        s1 = peg$c0;
	      }
	      if (s1 !== peg$FAILED) {
	        peg$reportedPos = s0;
	        s1 = peg$c42(s1);
	      }
	      s0 = s1;

	      return s0;
	    }

	    function peg$parseReal() {
	      var s0, s1, s2, s3, s4;

	      s0 = peg$currPos;
	      s1 = peg$currPos;
	      s2 = peg$parseInteger();
	      if (s2 !== peg$FAILED) {
	        if (input.charCodeAt(peg$currPos) === 46) {
	          s3 = peg$c11;
	          peg$currPos++;
	        } else {
	          s3 = peg$FAILED;
	          if (peg$silentFails === 0) { peg$fail(peg$c12); }
	        }
	        if (s3 !== peg$FAILED) {
	          s4 = peg$parseInteger();
	          if (s4 !== peg$FAILED) {
	            s2 = [s2, s3, s4];
	            s1 = s2;
	          } else {
	            peg$currPos = s1;
	            s1 = peg$c0;
	          }
	        } else {
	          peg$currPos = s1;
	          s1 = peg$c0;
	        }
	      } else {
	        peg$currPos = s1;
	        s1 = peg$c0;
	      }
	      if (s1 !== peg$FAILED) {
	        peg$reportedPos = s0;
	        s1 = peg$c43(s1);
	      }
	      s0 = s1;

	      return s0;
	    }

	    function peg$parseSignedInteger() {
	      var s0, s1, s2, s3;

	      s0 = peg$currPos;
	      if (peg$c45.test(input.charAt(peg$currPos))) {
	        s1 = input.charAt(peg$currPos);
	        peg$currPos++;
	      } else {
	        s1 = peg$FAILED;
	        if (peg$silentFails === 0) { peg$fail(peg$c46); }
	      }
	      if (s1 === peg$FAILED) {
	        s1 = peg$c44;
	      }
	      if (s1 !== peg$FAILED) {
	        s2 = [];
	        if (peg$c40.test(input.charAt(peg$currPos))) {
	          s3 = input.charAt(peg$currPos);
	          peg$currPos++;
	        } else {
	          s3 = peg$FAILED;
	          if (peg$silentFails === 0) { peg$fail(peg$c41); }
	        }
	        if (s3 !== peg$FAILED) {
	          while (s3 !== peg$FAILED) {
	            s2.push(s3);
	            if (peg$c40.test(input.charAt(peg$currPos))) {
	              s3 = input.charAt(peg$currPos);
	              peg$currPos++;
	            } else {
	              s3 = peg$FAILED;
	              if (peg$silentFails === 0) { peg$fail(peg$c41); }
	            }
	          }
	        } else {
	          s2 = peg$c0;
	        }
	        if (s2 !== peg$FAILED) {
	          s1 = [s1, s2];
	          s0 = s1;
	        } else {
	          peg$currPos = s0;
	          s0 = peg$c0;
	        }
	      } else {
	        peg$currPos = s0;
	        s0 = peg$c0;
	      }

	      return s0;
	    }

	    function peg$parseIdentifier() {
	      var s0, s1;

	      peg$silentFails++;
	      s0 = peg$currPos;
	      s1 = peg$parseIdentifierName();
	      if (s1 !== peg$FAILED) {
	        peg$reportedPos = s0;
	        s1 = peg$c48(s1);
	      }
	      s0 = s1;
	      peg$silentFails--;
	      if (s0 === peg$FAILED) {
	        s1 = peg$FAILED;
	        if (peg$silentFails === 0) { peg$fail(peg$c47); }
	      }

	      return s0;
	    }

	    function peg$parseIdentifierName() {
	      var s0, s1, s2, s3;

	      peg$silentFails++;
	      s0 = peg$currPos;
	      s1 = peg$parseIdentifierStart();
	      if (s1 !== peg$FAILED) {
	        s2 = [];
	        s3 = peg$parseIdentifierPart();
	        while (s3 !== peg$FAILED) {
	          s2.push(s3);
	          s3 = peg$parseIdentifierPart();
	        }
	        if (s2 !== peg$FAILED) {
	          peg$reportedPos = s0;
	          s1 = peg$c49(s1, s2);
	          s0 = s1;
	        } else {
	          peg$currPos = s0;
	          s0 = peg$c0;
	        }
	      } else {
	        peg$currPos = s0;
	        s0 = peg$c0;
	      }
	      peg$silentFails--;
	      if (s0 === peg$FAILED) {
	        s1 = peg$FAILED;
	        if (peg$silentFails === 0) { peg$fail(peg$c47); }
	      }

	      return s0;
	    }

	    function peg$parsePrimaryExpression() {
	      var s0, s1, s2, s3, s4, s5;

	      s0 = peg$currPos;
	      s1 = peg$parseIdentifier();
	      if (s1 !== peg$FAILED) {
	        peg$reportedPos = s0;
	        s1 = peg$c50(s1);
	      }
	      s0 = s1;
	      if (s0 === peg$FAILED) {
	        s0 = peg$parseLiteral();
	        if (s0 === peg$FAILED) {
	          s0 = peg$currPos;
	          if (input.charCodeAt(peg$currPos) === 40) {
	            s1 = peg$c51;
	            peg$currPos++;
	          } else {
	            s1 = peg$FAILED;
	            if (peg$silentFails === 0) { peg$fail(peg$c52); }
	          }
	          if (s1 !== peg$FAILED) {
	            s2 = peg$parse__();
	            if (s2 !== peg$FAILED) {
	              s3 = peg$parseLinearExpression();
	              if (s3 !== peg$FAILED) {
	                s4 = peg$parse__();
	                if (s4 !== peg$FAILED) {
	                  if (input.charCodeAt(peg$currPos) === 41) {
	                    s5 = peg$c53;
	                    peg$currPos++;
	                  } else {
	                    s5 = peg$FAILED;
	                    if (peg$silentFails === 0) { peg$fail(peg$c54); }
	                  }
	                  if (s5 !== peg$FAILED) {
	                    peg$reportedPos = s0;
	                    s1 = peg$c3(s3);
	                    s0 = s1;
	                  } else {
	                    peg$currPos = s0;
	                    s0 = peg$c0;
	                  }
	                } else {
	                  peg$currPos = s0;
	                  s0 = peg$c0;
	                }
	              } else {
	                peg$currPos = s0;
	                s0 = peg$c0;
	              }
	            } else {
	              peg$currPos = s0;
	              s0 = peg$c0;
	            }
	          } else {
	            peg$currPos = s0;
	            s0 = peg$c0;
	          }
	        }
	      }

	      return s0;
	    }

	    function peg$parseUnaryExpression() {
	      var s0, s1, s2, s3;

	      s0 = peg$parsePrimaryExpression();
	      if (s0 === peg$FAILED) {
	        s0 = peg$currPos;
	        s1 = peg$parseUnaryOperator();
	        if (s1 !== peg$FAILED) {
	          s2 = peg$parse__();
	          if (s2 !== peg$FAILED) {
	            s3 = peg$parseUnaryExpression();
	            if (s3 !== peg$FAILED) {
	              peg$reportedPos = s0;
	              s1 = peg$c55(s1, s3);
	              s0 = s1;
	            } else {
	              peg$currPos = s0;
	              s0 = peg$c0;
	            }
	          } else {
	            peg$currPos = s0;
	            s0 = peg$c0;
	          }
	        } else {
	          peg$currPos = s0;
	          s0 = peg$c0;
	        }
	      }

	      return s0;
	    }

	    function peg$parseUnaryOperator() {
	      var s0;

	      if (input.charCodeAt(peg$currPos) === 43) {
	        s0 = peg$c56;
	        peg$currPos++;
	      } else {
	        s0 = peg$FAILED;
	        if (peg$silentFails === 0) { peg$fail(peg$c57); }
	      }
	      if (s0 === peg$FAILED) {
	        if (input.charCodeAt(peg$currPos) === 45) {
	          s0 = peg$c58;
	          peg$currPos++;
	        } else {
	          s0 = peg$FAILED;
	          if (peg$silentFails === 0) { peg$fail(peg$c59); }
	        }
	        if (s0 === peg$FAILED) {
	          if (input.charCodeAt(peg$currPos) === 33) {
	            s0 = peg$c60;
	            peg$currPos++;
	          } else {
	            s0 = peg$FAILED;
	            if (peg$silentFails === 0) { peg$fail(peg$c61); }
	          }
	        }
	      }

	      return s0;
	    }

	    function peg$parseMultiplicativeExpression() {
	      var s0, s1, s2, s3, s4, s5, s6, s7;

	      s0 = peg$currPos;
	      s1 = peg$parseUnaryExpression();
	      if (s1 !== peg$FAILED) {
	        s2 = [];
	        s3 = peg$currPos;
	        s4 = peg$parse__();
	        if (s4 !== peg$FAILED) {
	          s5 = peg$parseMultiplicativeOperator();
	          if (s5 !== peg$FAILED) {
	            s6 = peg$parse__();
	            if (s6 !== peg$FAILED) {
	              s7 = peg$parseUnaryExpression();
	              if (s7 !== peg$FAILED) {
	                s4 = [s4, s5, s6, s7];
	                s3 = s4;
	              } else {
	                peg$currPos = s3;
	                s3 = peg$c0;
	              }
	            } else {
	              peg$currPos = s3;
	              s3 = peg$c0;
	            }
	          } else {
	            peg$currPos = s3;
	            s3 = peg$c0;
	          }
	        } else {
	          peg$currPos = s3;
	          s3 = peg$c0;
	        }
	        while (s3 !== peg$FAILED) {
	          s2.push(s3);
	          s3 = peg$currPos;
	          s4 = peg$parse__();
	          if (s4 !== peg$FAILED) {
	            s5 = peg$parseMultiplicativeOperator();
	            if (s5 !== peg$FAILED) {
	              s6 = peg$parse__();
	              if (s6 !== peg$FAILED) {
	                s7 = peg$parseUnaryExpression();
	                if (s7 !== peg$FAILED) {
	                  s4 = [s4, s5, s6, s7];
	                  s3 = s4;
	                } else {
	                  peg$currPos = s3;
	                  s3 = peg$c0;
	                }
	              } else {
	                peg$currPos = s3;
	                s3 = peg$c0;
	              }
	            } else {
	              peg$currPos = s3;
	              s3 = peg$c0;
	            }
	          } else {
	            peg$currPos = s3;
	            s3 = peg$c0;
	          }
	        }
	        if (s2 !== peg$FAILED) {
	          peg$reportedPos = s0;
	          s1 = peg$c62(s1, s2);
	          s0 = s1;
	        } else {
	          peg$currPos = s0;
	          s0 = peg$c0;
	        }
	      } else {
	        peg$currPos = s0;
	        s0 = peg$c0;
	      }

	      return s0;
	    }

	    function peg$parseMultiplicativeOperator() {
	      var s0;

	      if (input.charCodeAt(peg$currPos) === 42) {
	        s0 = peg$c63;
	        peg$currPos++;
	      } else {
	        s0 = peg$FAILED;
	        if (peg$silentFails === 0) { peg$fail(peg$c64); }
	      }
	      if (s0 === peg$FAILED) {
	        if (input.charCodeAt(peg$currPos) === 47) {
	          s0 = peg$c65;
	          peg$currPos++;
	        } else {
	          s0 = peg$FAILED;
	          if (peg$silentFails === 0) { peg$fail(peg$c66); }
	        }
	      }

	      return s0;
	    }

	    function peg$parseAdditiveExpression() {
	      var s0, s1, s2, s3, s4, s5, s6, s7;

	      s0 = peg$currPos;
	      s1 = peg$parseMultiplicativeExpression();
	      if (s1 !== peg$FAILED) {
	        s2 = [];
	        s3 = peg$currPos;
	        s4 = peg$parse__();
	        if (s4 !== peg$FAILED) {
	          s5 = peg$parseAdditiveOperator();
	          if (s5 !== peg$FAILED) {
	            s6 = peg$parse__();
	            if (s6 !== peg$FAILED) {
	              s7 = peg$parseMultiplicativeExpression();
	              if (s7 !== peg$FAILED) {
	                s4 = [s4, s5, s6, s7];
	                s3 = s4;
	              } else {
	                peg$currPos = s3;
	                s3 = peg$c0;
	              }
	            } else {
	              peg$currPos = s3;
	              s3 = peg$c0;
	            }
	          } else {
	            peg$currPos = s3;
	            s3 = peg$c0;
	          }
	        } else {
	          peg$currPos = s3;
	          s3 = peg$c0;
	        }
	        while (s3 !== peg$FAILED) {
	          s2.push(s3);
	          s3 = peg$currPos;
	          s4 = peg$parse__();
	          if (s4 !== peg$FAILED) {
	            s5 = peg$parseAdditiveOperator();
	            if (s5 !== peg$FAILED) {
	              s6 = peg$parse__();
	              if (s6 !== peg$FAILED) {
	                s7 = peg$parseMultiplicativeExpression();
	                if (s7 !== peg$FAILED) {
	                  s4 = [s4, s5, s6, s7];
	                  s3 = s4;
	                } else {
	                  peg$currPos = s3;
	                  s3 = peg$c0;
	                }
	              } else {
	                peg$currPos = s3;
	                s3 = peg$c0;
	              }
	            } else {
	              peg$currPos = s3;
	              s3 = peg$c0;
	            }
	          } else {
	            peg$currPos = s3;
	            s3 = peg$c0;
	          }
	        }
	        if (s2 !== peg$FAILED) {
	          peg$reportedPos = s0;
	          s1 = peg$c67(s1, s2);
	          s0 = s1;
	        } else {
	          peg$currPos = s0;
	          s0 = peg$c0;
	        }
	      } else {
	        peg$currPos = s0;
	        s0 = peg$c0;
	      }

	      return s0;
	    }

	    function peg$parseAdditiveOperator() {
	      var s0;

	      if (input.charCodeAt(peg$currPos) === 43) {
	        s0 = peg$c56;
	        peg$currPos++;
	      } else {
	        s0 = peg$FAILED;
	        if (peg$silentFails === 0) { peg$fail(peg$c57); }
	      }
	      if (s0 === peg$FAILED) {
	        if (input.charCodeAt(peg$currPos) === 45) {
	          s0 = peg$c58;
	          peg$currPos++;
	        } else {
	          s0 = peg$FAILED;
	          if (peg$silentFails === 0) { peg$fail(peg$c59); }
	        }
	      }

	      return s0;
	    }

	    function peg$parseInequalityExpression() {
	      var s0, s1, s2, s3, s4, s5, s6, s7, s8;

	      s0 = peg$currPos;
	      s1 = peg$parseAdditiveExpression();
	      if (s1 !== peg$FAILED) {
	        s2 = [];
	        s3 = peg$currPos;
	        s4 = peg$parse__();
	        if (s4 !== peg$FAILED) {
	          s5 = peg$parseInequalityOperator();
	          if (s5 !== peg$FAILED) {
	            s6 = peg$parse__();
	            if (s6 !== peg$FAILED) {
	              s7 = peg$parseAdditiveExpression();
	              if (s7 !== peg$FAILED) {
	                s8 = peg$parseStrengthExpression();
	                if (s8 === peg$FAILED) {
	                  s8 = peg$c44;
	                }
	                if (s8 !== peg$FAILED) {
	                  s4 = [s4, s5, s6, s7, s8];
	                  s3 = s4;
	                } else {
	                  peg$currPos = s3;
	                  s3 = peg$c0;
	                }
	              } else {
	                peg$currPos = s3;
	                s3 = peg$c0;
	              }
	            } else {
	              peg$currPos = s3;
	              s3 = peg$c0;
	            }
	          } else {
	            peg$currPos = s3;
	            s3 = peg$c0;
	          }
	        } else {
	          peg$currPos = s3;
	          s3 = peg$c0;
	        }
	        while (s3 !== peg$FAILED) {
	          s2.push(s3);
	          s3 = peg$currPos;
	          s4 = peg$parse__();
	          if (s4 !== peg$FAILED) {
	            s5 = peg$parseInequalityOperator();
	            if (s5 !== peg$FAILED) {
	              s6 = peg$parse__();
	              if (s6 !== peg$FAILED) {
	                s7 = peg$parseAdditiveExpression();
	                if (s7 !== peg$FAILED) {
	                  s8 = peg$parseStrengthExpression();
	                  if (s8 === peg$FAILED) {
	                    s8 = peg$c44;
	                  }
	                  if (s8 !== peg$FAILED) {
	                    s4 = [s4, s5, s6, s7, s8];
	                    s3 = s4;
	                  } else {
	                    peg$currPos = s3;
	                    s3 = peg$c0;
	                  }
	                } else {
	                  peg$currPos = s3;
	                  s3 = peg$c0;
	                }
	              } else {
	                peg$currPos = s3;
	                s3 = peg$c0;
	              }
	            } else {
	              peg$currPos = s3;
	              s3 = peg$c0;
	            }
	          } else {
	            peg$currPos = s3;
	            s3 = peg$c0;
	          }
	        }
	        if (s2 !== peg$FAILED) {
	          peg$reportedPos = s0;
	          s1 = peg$c68(s1, s2);
	          s0 = s1;
	        } else {
	          peg$currPos = s0;
	          s0 = peg$c0;
	        }
	      } else {
	        peg$currPos = s0;
	        s0 = peg$c0;
	      }

	      return s0;
	    }

	    function peg$parseInequalityOperator() {
	      var s0;

	      if (input.substr(peg$currPos, 2) === peg$c69) {
	        s0 = peg$c69;
	        peg$currPos += 2;
	      } else {
	        s0 = peg$FAILED;
	        if (peg$silentFails === 0) { peg$fail(peg$c70); }
	      }
	      if (s0 === peg$FAILED) {
	        if (input.substr(peg$currPos, 2) === peg$c71) {
	          s0 = peg$c71;
	          peg$currPos += 2;
	        } else {
	          s0 = peg$FAILED;
	          if (peg$silentFails === 0) { peg$fail(peg$c72); }
	        }
	        if (s0 === peg$FAILED) {
	          if (input.charCodeAt(peg$currPos) === 60) {
	            s0 = peg$c73;
	            peg$currPos++;
	          } else {
	            s0 = peg$FAILED;
	            if (peg$silentFails === 0) { peg$fail(peg$c74); }
	          }
	          if (s0 === peg$FAILED) {
	            if (input.charCodeAt(peg$currPos) === 62) {
	              s0 = peg$c75;
	              peg$currPos++;
	            } else {
	              s0 = peg$FAILED;
	              if (peg$silentFails === 0) { peg$fail(peg$c76); }
	            }
	          }
	        }
	      }

	      return s0;
	    }

	    function peg$parseStrength() {
	      var s0;

	      if (input.substr(peg$currPos, 9) === peg$c77) {
	        s0 = peg$c77;
	        peg$currPos += 9;
	      } else {
	        s0 = peg$FAILED;
	        if (peg$silentFails === 0) { peg$fail(peg$c78); }
	      }
	      if (s0 === peg$FAILED) {
	        if (input.substr(peg$currPos, 7) === peg$c79) {
	          s0 = peg$c79;
	          peg$currPos += 7;
	        } else {
	          s0 = peg$FAILED;
	          if (peg$silentFails === 0) { peg$fail(peg$c80); }
	        }
	        if (s0 === peg$FAILED) {
	          if (input.substr(peg$currPos, 7) === peg$c81) {
	            s0 = peg$c81;
	            peg$currPos += 7;
	          } else {
	            s0 = peg$FAILED;
	            if (peg$silentFails === 0) { peg$fail(peg$c82); }
	          }
	          if (s0 === peg$FAILED) {
	            if (input.substr(peg$currPos, 5) === peg$c83) {
	              s0 = peg$c83;
	              peg$currPos += 5;
	            } else {
	              s0 = peg$FAILED;
	              if (peg$silentFails === 0) { peg$fail(peg$c84); }
	            }
	          }
	        }
	      }

	      return s0;
	    }

	    function peg$parseStrengthExpression() {
	      var s0, s1, s2;

	      s0 = peg$currPos;
	      s1 = peg$parse__();
	      if (s1 !== peg$FAILED) {
	        s2 = peg$parseStrength();
	        if (s2 !== peg$FAILED) {
	          peg$reportedPos = s0;
	          s1 = peg$c85(s2);
	          s0 = s1;
	        } else {
	          peg$currPos = s0;
	          s0 = peg$c0;
	        }
	      } else {
	        peg$currPos = s0;
	        s0 = peg$c0;
	      }

	      return s0;
	    }

	    function peg$parseLinearExpression() {
	      var s0, s1, s2, s3, s4, s5, s6, s7, s8;

	      s0 = peg$currPos;
	      s1 = peg$parseInequalityExpression();
	      if (s1 !== peg$FAILED) {
	        s2 = [];
	        s3 = peg$currPos;
	        s4 = peg$parse__();
	        if (s4 !== peg$FAILED) {
	          if (input.substr(peg$currPos, 2) === peg$c86) {
	            s5 = peg$c86;
	            peg$currPos += 2;
	          } else {
	            s5 = peg$FAILED;
	            if (peg$silentFails === 0) { peg$fail(peg$c87); }
	          }
	          if (s5 !== peg$FAILED) {
	            s6 = peg$parse__();
	            if (s6 !== peg$FAILED) {
	              s7 = peg$parseInequalityExpression();
	              if (s7 !== peg$FAILED) {
	                s8 = peg$parseStrengthExpression();
	                if (s8 === peg$FAILED) {
	                  s8 = peg$c44;
	                }
	                if (s8 !== peg$FAILED) {
	                  s4 = [s4, s5, s6, s7, s8];
	                  s3 = s4;
	                } else {
	                  peg$currPos = s3;
	                  s3 = peg$c0;
	                }
	              } else {
	                peg$currPos = s3;
	                s3 = peg$c0;
	              }
	            } else {
	              peg$currPos = s3;
	              s3 = peg$c0;
	            }
	          } else {
	            peg$currPos = s3;
	            s3 = peg$c0;
	          }
	        } else {
	          peg$currPos = s3;
	          s3 = peg$c0;
	        }
	        while (s3 !== peg$FAILED) {
	          s2.push(s3);
	          s3 = peg$currPos;
	          s4 = peg$parse__();
	          if (s4 !== peg$FAILED) {
	            if (input.substr(peg$currPos, 2) === peg$c86) {
	              s5 = peg$c86;
	              peg$currPos += 2;
	            } else {
	              s5 = peg$FAILED;
	              if (peg$silentFails === 0) { peg$fail(peg$c87); }
	            }
	            if (s5 !== peg$FAILED) {
	              s6 = peg$parse__();
	              if (s6 !== peg$FAILED) {
	                s7 = peg$parseInequalityExpression();
	                if (s7 !== peg$FAILED) {
	                  s8 = peg$parseStrengthExpression();
	                  if (s8 === peg$FAILED) {
	                    s8 = peg$c44;
	                  }
	                  if (s8 !== peg$FAILED) {
	                    s4 = [s4, s5, s6, s7, s8];
	                    s3 = s4;
	                  } else {
	                    peg$currPos = s3;
	                    s3 = peg$c0;
	                  }
	                } else {
	                  peg$currPos = s3;
	                  s3 = peg$c0;
	                }
	              } else {
	                peg$currPos = s3;
	                s3 = peg$c0;
	              }
	            } else {
	              peg$currPos = s3;
	              s3 = peg$c0;
	            }
	          } else {
	            peg$currPos = s3;
	            s3 = peg$c0;
	          }
	        }
	        if (s2 !== peg$FAILED) {
	          peg$reportedPos = s0;
	          s1 = peg$c88(s1, s2);
	          s0 = s1;
	        } else {
	          peg$currPos = s0;
	          s0 = peg$c0;
	        }
	      } else {
	        peg$currPos = s0;
	        s0 = peg$c0;
	      }

	      return s0;
	    }

	    peg$result = peg$startRuleFunction();

	    if (peg$result !== peg$FAILED && peg$currPos === input.length) {
	      return peg$result;
	    } else {
	      if (peg$result !== peg$FAILED && peg$currPos < input.length) {
	        peg$fail({ type: "end", description: "end of input" });
	      }

	      throw peg$buildException(null, peg$maxFailExpected, peg$maxFailPos);
	    }
	  }

	  return {
	    SyntaxError: SyntaxError,
	    parse:       parse
	  };
	})();

/***/ },
/* 6 */
/***/ function(module, exports, __webpack_require__) {

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


/***/ },
/* 7 */
/***/ function(module, exports, __webpack_require__) {

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

	var MotionContext = __webpack_require__(4);
	var Box = __webpack_require__(1);
	var MotionConstraint = __webpack_require__(3);
	var Manipulator = __webpack_require__(2);
	var parser = __webpack_require__(5);

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


/***/ }
/******/ ])
})
