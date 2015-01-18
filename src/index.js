'use strict';

var Slalom = {
    MotionContext: require('./MotionContext.js'),
    Manipulator: require('./Manipulator.js'),
    MotionConstraint: require('./MotionConstraint.js'),
    Box: require('./Box.js')
};

// Hacky.
window.Slalom = Slalom;

module.exports = Slalom;
