RESPONSES_BASE_DIR := $(shell git rev-parse --show-toplevel)
MICROSERVICE_DIR := $(RESPONSES_BASE_DIR)/microservice

.PHONY: microservice-install microservice-build microservice-dev microservice-start

microservice-install:
	npm --prefix $(MICROSERVICE_DIR) install

microservice-build:
	npm --prefix $(MICROSERVICE_DIR) run build

microservice-dev:
	npm --prefix $(MICROSERVICE_DIR) run dev

microservice-start:
	npm --prefix $(MICROSERVICE_DIR) run start
