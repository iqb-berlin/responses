RESPONSES_BASE_DIR := $(shell git rev-parse --show-toplevel)
MK_FILE_DIR := $(RESPONSES_BASE_DIR)/scripts/make

microservice-install:
	$(MAKE) -f $(MK_FILE_DIR)/microservice.mk -C $(MK_FILE_DIR) $@

microservice-build:
	$(MAKE) -f $(MK_FILE_DIR)/microservice.mk -C $(MK_FILE_DIR) $@

microservice-dev:
	$(MAKE) -f $(MK_FILE_DIR)/microservice.mk -C $(MK_FILE_DIR) $@

microservice-start:
	$(MAKE) -f $(MK_FILE_DIR)/microservice.mk -C $(MK_FILE_DIR) $@

load-test-responses-schemes-code:
	$(MAKE) -f $(MK_FILE_DIR)/load-test.mk -C $(MK_FILE_DIR) $@
