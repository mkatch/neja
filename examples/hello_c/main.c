#include <stdio.h>
#include "greeting.h"

int main(int argc, char **argv) {
	if (argc < 2) {
		return 1;
	}

	const char *name = argv[1];
	char greeting[256];
	format_greeting(name, greeting, sizeof(greeting));
	printf("%s\n", greeting);

	return 0;
}