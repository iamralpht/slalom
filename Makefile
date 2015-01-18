all: slalom.js

slalom.js: src/*.js
	@(cd src; browserify -o ../slalom.js index.js)

clean:
	@rm slalom.js
