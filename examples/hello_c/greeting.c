#include <stdio.h>

void format_greeting(const char *name, char *buffer, size_t buffer_size) {
	snprintf(buffer, buffer_size, "Hello, %s!", name);
}