# Makefile for premium local dev experience

SHELL := /bin/bash
PORT ?= 3000

.PHONY: premium full infra bg stop logs health reset seed seed-avail smoke smoke-all e2e-report browsers check e2e-stable e2e-standalone

premium:
	npm run dev:premium

full:
	npm run dev:full

infra:
	npm run dev:infra

bg:
	npm run dev:bg

stop:
	npm run dev:stop

logs:
	npm run dev:logs

health:
	PORT=$(PORT) npm run -s health:check

reset:
	npm run -s db:reset:full

seed:
	npm run -s seed:full

seed-avail:
	PORT=$(PORT) npm run -s seed:avail

smoke:
	npm run -s smoke

smoke-all:
	npm run -s smoke:all

browsers:
	npm run -s browsers:install

check:
	npm run -s check

e2e-stable:
	npm run -s test:e2e:stable

e2e-standalone:
	npm run -s test:e2e:standalone

e2e-report:
	npm run -s e2e:report

