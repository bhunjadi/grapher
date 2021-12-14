#!/usr/bin/env bash

SCRIPT_PATH=$(cd $(dirname $0) && pwd)
TEST_PATH="$SCRIPT_PATH"/test

if [ ! -d "$TEST_PATH" ]
then
    echo "Test directory doesn't exist. Please run test_init.sh script first."
    exit -1
fi

cd "$TEST_PATH"
METEOR_PACKAGE_DIRS="../" TEST_BROWSER_DRIVER=puppeteer meteor test-packages --driver-package meteortesting:mocha "$@" ../
