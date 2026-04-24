RESPONSES_BASE_DIR := $(shell git rev-parse --show-toplevel)

.PHONY: load-test-responses-schemes-code

load-test-responses-schemes-code:
	$(RESPONSES_BASE_DIR)/scripts/load-tests/run-responses-schemes-code.sh $(K6_ARGS)
