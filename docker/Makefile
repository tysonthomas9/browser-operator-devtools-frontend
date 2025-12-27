# Makefile for Browser Operator Core
# Provides DevTools frontend + Agent Server deployments

.PHONY: help build devtools-up up down logs status chrome

help: ## Show this help
	@echo "Browser Operator Core - Docker Deployments"
	@echo "==========================================="
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-12s %s\n", $$1, $$2}'
	@echo ""
	@echo "Deployment options:"
	@echo "  Type 1: make devtools-up  # DevTools only (AUTOMATED_MODE=true by default)"
	@echo "  Type 2: make up           # DevTools + Agent Server (lightweight)"
	@echo ""
	@echo "Full build (includes agent-server in image):"
	@echo "  make build && docker-compose up -d"
	@echo ""
	@echo "For manual debugging mode (Type 1 without API key bypass):"
	@echo "  docker-compose build --build-arg AUTOMATED_MODE=false && make devtools-up"

build: ## Build full image (DevTools + Agent Server baked in)
	docker-compose build

devtools-up: ## Start DevTools only (Type 1)
	docker-compose up -d
	@echo ""
	@echo "DevTools UI: http://localhost:8000"

up: ## Start DevTools + Agent Server (Type 2 - lightweight)
	docker-compose -f docker-compose.lightweight.yml up -d
	@echo ""
	@echo "Services:"
	@echo "  DevTools:   http://localhost:8000"
	@echo "  Agent API:  http://localhost:8080"
	@echo "  Agent WS:   ws://localhost:8082"

down: ## Stop all containers
	docker-compose -f docker-compose.lightweight.yml down 2>/dev/null || true
	docker-compose down 2>/dev/null || true

logs: ## Show logs
	docker-compose -f docker-compose.lightweight.yml logs -f 2>/dev/null || docker-compose logs -f

status: ## Show container status
	@docker ps --filter "name=browser-operator"

chrome: ## Launch Chrome Canary with custom DevTools
	"/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary" \
		--remote-debugging-port=9222 \
		--remote-allow-origins="*" \
		--auto-open-devtools-for-tabs \
		--user-data-dir=/tmp/chrome-debug-profile \
		--custom-devtools-frontend=http://localhost:8000/
