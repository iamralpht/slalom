'use strict';
/*
Copyright 2015 Ralph Thomas

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

// Hack for iTunesRadio demo.
window.imagePrefix = '../../../iamralpht.github.io/physics/'

// Presentation. These are the slides.

var slidesModel = [
    { className: 'index', title: 'User Interface Physics', body: 'Ralph Thomas<br>21 January 2015' },
    { title: 'Who?', adoptBody: '#slide-1' },
    { title: 'What?', adoptBody: '#slide-2' },
    { title: 'How?', adoptBody: '#slide-3' },
    { title: 'Why?', adoptBody: '#slide-4' },
    { className: 'example', adoptBody: '#buttonExample' },
    { className: 'example', adoptBody: '#androidWearExample' },
    { className: 'example', adoptBody: '#lockScreenExample' },
    { className: 'example', adoptBody: '#iTunesRadioExample' },
    { className: 'example', adoptBody: '#FallingDialogsExample' },
    { className: 'example', adoptBody: '#FloatingActionButtonExample' },
    { title: 'But...', adoptBody: '#slide-5' },
    { title: 'What? (MkII)', adoptBody: '#slide-6' },
    { className: 'example slalomExamples', adoptBody: '#slalomExamples' },
    { className: 'longTitle', title: 'Tackles a large class of common interactions, but...', adoptBody: '#slide-7' },
    { title: 'Future work', adoptBody: '#slide-8' },
    { className: 'index', title: 'Thank you!', adoptBody: '#slide-9' }
];

function makeSlide(parentElement, model) {
    parentElement.className = 'slide ' + (model.className ? model.className : '');
    if (model.title) {
        var t = document.createElement('div');
        t.className = 'title';
        t.textContent = model.title;
        parentElement.appendChild(t);
    }
    if (model.body) {
        var b = document.createElement('div');
        b.className = 'body';
        b.innerHTML = model.body;
        parentElement.appendChild(b);
    }
    if (model.adoptBody) {
        var b = document.querySelector(model.adoptBody);
        if (b) parentElement.appendChild(b);
    }
}

function makeSlideDeck(parentElement) {
    var parentHeight = window.innerHeight;
    var parentWidth = window.innerWidth;

    var padding = 25;

    // Create a MotionContext and get the solver from it to add constraints to.
    var context = new Slalom.MotionContext();
    var solver = context.solver();

    // Horizontal scroll position.
    var scrollPosition = new c.Variable({name: 'horizontal-scroll-position'});

    var firstPhoto = null, lastPhoto = null;
    // We're just going to make a simple row of photos (using CSS3's background-size
    // property to position them).
    for (var i = 0; i < slidesModel.length; i++) {
        var p = new Slalom.Box();

        makeSlide(p.element(), slidesModel[i]);
        // We don't need constraints for the height since it doesn't move in y.
        p.y = 0;
        p.bottom = parentHeight;
        // These are related to the scroll position, so they must be variables.
        p.x = new c.Variable({name: 'photo-' + i + '-x'});//(parentWidth + padding * 2) * i;
        p.right = new c.Variable({name: 'photo-' +i +'-right'});//p.x + parentWidth;

        // x = scrollPosition + (width * i)
        solver.add(eq(p.x, c.plus(scrollPosition, (parentWidth + padding) * i), medium));
        // right = x + width
        solver.add(eq(p.right, c.plus(p.x, parentWidth), medium));

        // Add the photo to the parent and the context.
        parentElement.appendChild(p.element());
        context.addBox(p);
        
        // Remember the first and last photos for some motion constraints.
        if (!firstPhoto) firstPhoto = p;
        lastPhoto = p;
    }

    // Motion constraint to enforce pager behavior.
    var motionConstraint = new Slalom.MotionConstraint(scrollPosition, Slalom.MotionConstraint.ops.adjacentModulo, parentWidth + padding, { overdragCoefficient: 0 });
    context.addMotionConstraint(motionConstraint);

    // Some basic motion constraints to stop us going past the ends.
    context.addMotionConstraint(new Slalom.MotionConstraint(firstPhoto.x, '<=', 0));
    context.addMotionConstraint(new Slalom.MotionConstraint(lastPhoto.right, '>=', parentWidth));


    // Add a manipulator to scroll through the photos.
    context.addManipulator(createManipulator(scrollPosition, parentElement, 'x'));
}

makeSlideDeck(document.body);
