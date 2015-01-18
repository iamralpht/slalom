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
