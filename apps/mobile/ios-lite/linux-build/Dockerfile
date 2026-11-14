FROM ruby:3.4
ARG NODE_VERSION
RUN apt-get update -qq && apt-get install -y -qq rsync unzip file xz-utils >/dev/null
# CocoaPods runs Node to evaluate the React Native and Expo podspecs.
RUN curl -fsSL --http1.1 --retry 5 "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.xz" \
  | tar -xJ --strip-components=1 -C /usr/local
