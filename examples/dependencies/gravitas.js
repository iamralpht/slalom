(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define(factory);
	else if(typeof exports === 'object')
		exports["Gravitas"] = factory();
	else
		root["Gravitas"] = factory();
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
	/*
	Copyright 2014 Ralph Thomas

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

	var Gravitas = {
	    // Basic essentials.
	    Spring: __webpack_require__(2),
	    Gravity: __webpack_require__(1),
	    Friction: __webpack_require__(5),
	    // Composites.
	    GravityWithBounce: __webpack_require__(6),
	    Fall: __webpack_require__(4),
	    // Utilities
	    createAnimation: __webpack_require__(3)
	}

	module.exports = Gravitas;


/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	/*
	Copyright 2014 Ralph Thomas

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

	/***
	 * Gravity physics simulation. This actually just simulates
	 * Newton's second law, F=ma integrated to x' = x + v*t + 0.5*a*t*t.
	 *
	 * Note that gravity is never done, so we pass in an explicit termination point beyond which we
	 * declare ourselves "done".
	 */
	function Gravity(acceleration, terminate) {
	    this._acceleration = acceleration;
	    this._terminate = terminate;

	    this._x = 0;
	    this._v = 0;
	    this._a = acceleration;
	    this._startTime = 0;
	}
	Gravity.prototype.set = function(x, v) {
	    this._x = x;
	    this._v = v;
	    this._startTime = (new Date()).getTime();
	}
	Gravity.prototype.x = function(dt) {
	    var t = (new Date()).getTime();
	    if (dt == undefined) dt = (t - this._startTime) / 1000.0;
	    return this._x + this._v * dt + 0.5 * this._a * dt * dt;
	}
	Gravity.prototype.dx = function() {
	    var t = (new Date()).getTime();
	    var dt = (t - this._startTime) / 1000.0;

	    return this._v + dt * this._a;
	}
	Gravity.prototype.done = function() {
	    return Math.abs(this.x()) > this._terminate;
	}
	Gravity.prototype.reconfigure = function(a) {
	    this.set(this.x(), this.dx());
	    this._a = a;
	}
	Gravity.prototype.configuration = function() {
	    var self = this;
	    return [
	        { label: 'Acceleration', read: function() { return self._a; }, write: this.reconfigure.bind(this), min: -3000, max: 3000 }
	    ];
	}

	module.exports = Gravity;



/***/ },
/* 2 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	/*
	Copyright 2014 Ralph Thomas

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

	var epsilon = 0.001;
	function almostEqual(a, b, epsilon) { return (a > (b - epsilon)) && (a < (b + epsilon)); }
	function almostZero(a, epsilon) { return almostEqual(a, 0, epsilon); }

	/***
	 * Simple Spring implementation -- this implements a damped spring using a symbolic integration
	 * of Hooke's law: F = -kx - cv. This solution is significantly more performant and less code than
	 * a numerical approach such as Facebook Rebound which uses RK4.
	 *
	 * This physics textbook explains the model:
	 *  http://www.stewartcalculus.com/data/CALCULUS%20Concepts%20and%20Contexts/upfiles/3c3-AppsOf2ndOrders_Stu.pdf
	 *
	 * A critically damped spring has: damping*damping - 4 * mass * springConstant == 0. If it's greater than zero
	 * then the spring is overdamped, if it's less than zero then it's underdamped.
	 */
	function Spring(mass, springConstant, damping) {
	    this._m = mass;
	    this._k = springConstant;
	    this._c = damping;
	    this._solution = null;
	    this._endPosition = 0;
	    this._startTime = 0;
	}
	Spring.prototype._solve = function(initial, velocity) {
	    var c = this._c;
	    var m = this._m;
	    var k = this._k;
	    // Solve the quadratic equation; root = (-c +/- sqrt(c^2 - 4mk)) / 2m.
	    var cmk = c * c - 4 * m * k;
	    if (cmk == 0) {
	        // The spring is critically damped.
	        // x = (c1 + c2*t) * e ^(-c/2m)*t
	        var r = -c / (2 * m);
	        var c1 = initial;
	        var c2 = velocity / (r * initial);
	        return {
	            x: function(t) { return (c1 + c2 * t) * Math.pow(Math.E, r * t); },
	            dx: function(t) { var pow = Math.pow(Math.E, r * t); return r * (c1 + c2 * t) * pow + c2 * pow; }
	        };
	    } else if (cmk > 0) {
	        // The spring is overdamped; no bounces.
	        // x = c1*e^(r1*t) + c2*e^(r2t)
	        // Need to find r1 and r2, the roots, then solve c1 and c2.
	        var r1 = (-c - Math.sqrt(cmk)) / (2 * m);
	        var r2 = (-c + Math.sqrt(cmk)) / (2 * m);
	        var c2 = (velocity - r1 * initial) / (r2 - r1);
	        var c1 = initial - c2;

	        return {
	            x: function(t) { return (c1 * Math.pow(Math.E, r1 * t) + c2 * Math.pow(Math.E, r2 * t)); },
	            dx: function(t) { return (c1 * r1 * Math.pow(Math.E, r1 * t) + c2 * r2 * Math.pow(Math.E, r2 * t)); }
	            };
	    } else {
	        // The spring is underdamped, it has imaginary roots.
	        // r = -(c / 2*m) +- w*i
	        // w = sqrt(4mk - c^2) / 2m
	        // x = (e^-(c/2m)t) * (c1 * cos(wt) + c2 * sin(wt))
	        var w = Math.sqrt(4*m*k - c*c) / (2 * m);
	        var r = -(c / 2*m);
	        var c1= initial;
	        var c2= (velocity - r * initial) / w;
	            
	        return {
	            x: function(t) { return Math.pow(Math.E, r * t) * (c1 * Math.cos(w * t) + c2 * Math.sin(w * t)); },
	            dx: function(t) {
	                var power =  Math.pow(Math.E, r * t);
	                var cos = Math.cos(w * t);
	                var sin = Math.sin(w * t);
	                return power * (c2 * w * cos - c1 * w * sin) + r * power * (c2 * sin + c1 * cos);
	            }
	        };
	    }
	}
	Spring.prototype.x = function(dt) {
	    if (dt == undefined) dt = ((new Date()).getTime() - this._startTime) / 1000.0;
	    return this._solution ? this._endPosition + this._solution.x(dt) : 0;
	}
	Spring.prototype.dx = function(dt) {
	    if (dt == undefined) dt = ((new Date()).getTime() - this._startTime) / 1000.0;
	    return this._solution ? this._solution.dx(dt) : 0;
	}
	Spring.prototype.setEnd = function(x, velocity, t) {
	    if (!t) t = (new Date()).getTime();
	    if (x == this._endPosition && almostZero(velocity, epsilon)) return;
	    velocity = velocity || 0;
	    var position = this._endPosition;
	    if (this._solution) {
	        // Don't whack incoming velocity.
	        if (almostZero(velocity, epsilon))
	            velocity = this._solution.dx((t - this._startTime) / 1000.0);
	        position = this._solution.x((t - this._startTime) / 1000.0);
	        if (almostZero(velocity, epsilon)) velocity = 0;
	        if (almostZero(position, epsilon)) position = 0;
	        position += this._endPosition;
	    }
	    if (this._solution && almostZero(position - x, epsilon) && almostZero(velocity, epsilon)) {
	        return;
	    }
	    this._endPosition = x;
	    this._solution = this._solve(position - this._endPosition, velocity);
	    this._startTime = t;
	}
	Spring.prototype.snap = function(x) {
	    this._startTime = (new Date()).getTime();
	    this._endPosition = x;
	    this._solution = {
	        x: function() { return 0; },
	        dx: function() { return 0; }
	    };
	}
	Spring.prototype.done = function(t) {
	    if (!t) t = (new Date()).getTime();
	    return almostEqual(this.x(), this._endPosition, epsilon) && almostZero(this.dx(), epsilon);
	}
	Spring.prototype.reconfigure = function(mass, springConstant, damping) {
	    this._m = mass;
	    this._k = springConstant;
	    this._c = damping;

	    if (this.done()) return;
	    this._solution = this._solve(this.x() - this._endPosition, this.dx());
	    this._startTime = (new Date()).getTime();
	}
	Spring.prototype.springConstant = function() { return this._k; }
	Spring.prototype.damping = function() { return this._c; }

	Spring.prototype.configuration = function() {
	    function setSpringConstant(s, c) { s.reconfigure(1, c, s.damping()); };
	    function setSpringDamping(s, d) { s.reconfigure(1, s.springConstant(), d); }
	    return [
	        { label: 'Spring Constant', read: this.springConstant.bind(this), write: setSpringConstant.bind(this, this), min: 100, max: 1000 },
	        { label: 'Damping', read: this.damping.bind(this), write: setSpringDamping.bind(this, this), min: 1, max: 500 }
	    ];
	}

	module.exports = Spring;


/***/ },
/* 3 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	/*
	Copyright 2014 Ralph Thomas

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

	// This function sets up a requestAnimationFrame-based timer which calls
	// the callback every frame while the physics model is still moving.
	// It returns a function that may be called to cancel the animation.
	function createAnimation(physicsModel, callback) {
	    
	    function onFrame(handle, model, cb) {
	        if (handle && handle.cancelled) return;
	        cb(model);
	        if (!physicsModel.done() && !handle.cancelled) {
	            handle.id = requestAnimationFrame(onFrame.bind(null, handle, model, cb));
	        }
	    }
	    function cancel(handle) {
	        if (handle && handle.id)
	            cancelAnimationFrame(handle.id);
	        if (handle)
	            handle.cancelled = true;
	    }

	    var handle = { id: 0, cancelled: false };
	    onFrame(handle, physicsModel, callback);

	    return { cancel: cancel.bind(null, handle), model: physicsModel };
	}

	module.exports = createAnimation;


/***/ },
/* 4 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	/*
	Copyright 2014 Ralph Thomas

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

	var Spring = __webpack_require__(2);
	var Gravity = __webpack_require__(1);

	/***
	 * Fall with Soft Landing simulation. This is an example of combining simulations
	 * to create something new. Here we're combining gravity with a spring: the value
	 * falls under gravity, and when it passes a certain point its momentum is rolled
	 * into a spring which supports it.
	 *
	 * The way that we transition between the two simulations is pretty weak: on the
	 * frame that we go through the ground we switch to using the spring. In practice
	 * this looks fine, but if we dropped a lot of frames then we could end up with
	 * an enormous velocity from gravity before we switched to the spring. It would
	 * be better to compute when the gravity reaches the ground and then switch based
	 * on that specific time. In the case of gravity that's an easily solvable
	 * equation, but things can get complicated computing the time when a spring
	 * reaches a certain position, so I'm showing the (cheesy but) generic method
	 * here.
	 */
	function Fall(ground, gravity, springC, springD) {
	    gravity = gravity || 5000;
	    springC = springC || 180;
	    springD = springD || 20;
	    this._ground = ground;
	    this._gravity = new Gravity(gravity, 1000);
	    this._spring = new Spring(1, springC, springD);
	    this._springing = false;
	}
	Fall.prototype.set = function(x, v) {
	    this._gravity.set(x, v);
	    if (x >= this._ground) {
	        this._springing = true;
	        this._spring.snap(x);
	        this._spring.setEnd(this._ground);
	    } else {
	        this._springing = false;
	    }
	}
	Fall.prototype.x = function() {
	    // Use the spring if we already hit the ground.
	    if (this._springing) {
	        return this._spring.x();
	    }
	    // Otherwise use gravity...
	    var x = this._gravity.x();
	    // Did we go through the ground?
	    if (x >= this._ground) {
	        // Yeah, switch to using the spring.
	        this._springing = true;
	        this._spring.snap(this._ground);
	        // Start the spring at the current position (the ground) but with all of the
	        // velocity from the gravity simulation. Because we use the same mass of "1" for
	        // everything, the velocity and momentum are equivalent.
	        this._spring.setEnd(this._ground, this._gravity.dx());
	        x = this._spring.x();
	    }
	    return x;
	}
	Fall.prototype.dx = function() {
	    if (this._springing) return this._spring.dx();
	    return this._gravity.dx();
	}
	Fall.prototype.done = function() {
	    if (this._springing) return this._spring.done();
	    return this._gravity.done();
	}
	Fall.prototype.configuration = function() {
	    var config = this._gravity.configuration();
	    config[0].min = 1;
	    config[0].max = 6000;
	    config.push.apply(config, this._spring.configuration());
	    return config;
	}

	module.exports = Fall;


/***/ },
/* 5 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	/*
	Copyright 2014 Ralph Thomas

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

	/***
	 * Friction physics simulation. Friction is actually just a simple
	 * power curve; the only trick is taking the natural log of the
	 * initial drag so that we can express the answer in terms of time.
	 */
	function Friction(drag) {
	    this._drag = drag;
	    this._dragLog = Math.log(drag);
	    this._x = 0;
	    this._v = 0;
	    this._startTime = 0;
	}
	Friction.prototype.set = function(x, v) {
	    this._x = x;
	    this._v = v;
	    this._startTime = (new Date()).getTime();
	}
	Friction.prototype.x = function(dt) {
	    if (dt == undefined) dt = ((new Date()).getTime() - this._startTime) / 1000;
	    return this._x + this._v * Math.pow(this._drag, dt) / this._dragLog - this._v / this._dragLog;
	}
	Friction.prototype.dx = function() {
	    var dt = ((new Date()).getTime() - this._startTime) / 1000;
	    return this._v * Math.pow(this._drag, dt);
	}
	Friction.prototype.done = function() {
	    return Math.abs(this.dx()) < 1;
	}
	Friction.prototype.reconfigure = function(drag) {
	    var x = this.x();
	    var v = this.dx();
	    this._drag = drag;
	    this._dragLog = Math.log(drag);
	    this.set(x, v);
	}
	Friction.prototype.configuration = function() {
	    var self = this;
	    return [
	        {
	            label: 'Friction',
	            read: function() { return self._drag; },
	            write: function(drag) { self.reconfigure(drag); },
	            min: 0.001,
	            max: 0.1,
	            step: 0.001
	        }
	    ];
	}

	module.exports = Friction


/***/ },
/* 6 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	/*
	Copyright 2014 Ralph Thomas

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

	var Gravity = __webpack_require__(1);
	/**
	 * This is an adaptation of Gravity to have a "floor" at 0. When the object hits
	 * the floor its velocity is inverted so that it bounces.
	 */
	function GravityWithBounce(acceleration, absorb) {
	    this._gravity = new Gravity(acceleration, 0);
	    this._absorb = absorb || 0.8;
	    this._reboundedLast = false;
	}
	GravityWithBounce.prototype.set = function(x, v) { this._gravity.set(x, v); }
	GravityWithBounce.prototype.x = function() {
	    var x = this._gravity.x();
	    // If x goes past zero then we're travelling under the floor, so invert
	    // the velocity.
	    // The end condition here is hacky; if we rebound two frames in a row then
	    // we decide we're done. Don't skip too many frames!
	    if (x > 0) {
	        if (this._reboundedLast) return 0;
	        this._reboundedLast = true;
	        var v = this._gravity.dx();
	        if (Math.abs(v * this._absorb) > Math.abs(this._gravity._a * 2) / 60)
	            this._gravity.set(0, -v * this._absorb);
	        return 0;
	    }
	    this._reboundedLast = false;
	    return x;
	}
	GravityWithBounce.prototype.dx = function() { return this._gravity.dx(); }
	GravityWithBounce.prototype.done = function() {
	    return this._gravity.x() > 1;
	}
	GravityWithBounce.prototype.reconfigure = function(a, absorb) {
	    this._gravity.reconfigure(a);
	    this._absorb = absorb || 0.8;
	}
	GravityWithBounce.prototype.configuration = function() {
	    var self = this;
	    var conf = this._gravity.configuration();
	    conf.push({
	        label: 'Rebound',
	        read: function() { return self._absorb; },
	        write: function(val) { self._absorb = val; },
	        min: 0,
	        max: 1.1,
	        step: 0.1
	    });
	    return conf;
	}

	module.exports = GravityWithBounce;


/***/ }
/******/ ])
})
