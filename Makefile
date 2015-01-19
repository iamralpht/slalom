all: slalom.js

slalom.js: src/*.js
	@(cd src; browserify -o ../slalom.js -s Slalom index.js)

clean:
	@rm slalom.js
