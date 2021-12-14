#!/usr/bin/env bash

SCRIPT_PATH=$(cd $(dirname $0) && pwd)
TEST_PATH="$SCRIPT_PATH"/test

if [ -d "$TEST_PATH" ]
then
    echo "Test directory exist, you can remove the directory and the run this script again."
    exit -1
fi

cd "$SCRIPT_PATH"

meteor create --bare test
cd test
meteor npm i puppeteer simpl-schema chai
