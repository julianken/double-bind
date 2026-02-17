/**
 * ULID shim for React Native.
 *
 * This is a complete ULID implementation that uses Math.random() instead of
 * crypto.randomBytes. The standard `ulid` package fails in React Native because
 * it tries to use Node's crypto module at import time.
 *
 * Implementation based on ulid spec: https://github.com/ulid/spec
 */

// Crockford's Base32 encoding
const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ENCODING_LEN = ENCODING.length;
const TIME_LEN = 10;
const RANDOM_LEN = 16;

function createError(message) {
  const err = new Error(message);
  err.source = 'ulid';
  return err;
}

function replaceCharAt(str, index, char) {
  if (index > str.length - 1) {
    return str;
  }
  return str.substr(0, index) + char + str.substr(index + 1);
}

function incrementBase32(str) {
  let done = undefined;
  let index = str.length;
  let char;
  let charIndex;
  const maxCharIndex = ENCODING_LEN - 1;
  while (!done && index-- >= 0) {
    char = str[index];
    charIndex = ENCODING.indexOf(char);
    if (charIndex === -1) {
      throw createError('incorrectly encoded string');
    }
    if (charIndex === maxCharIndex) {
      str = replaceCharAt(str, index, ENCODING[0]);
      continue;
    }
    done = replaceCharAt(str, index, ENCODING[charIndex + 1]);
  }
  if (typeof done === 'string') {
    return done;
  }
  throw createError('cannot increment this string');
}

function randomChar(prng) {
  let rand = Math.floor(prng() * ENCODING_LEN);
  if (rand === ENCODING_LEN) {
    rand = ENCODING_LEN - 1;
  }
  return ENCODING.charAt(rand);
}

function encodeTime(now, len) {
  if (isNaN(now)) {
    throw createError('Time must be a number');
  }
  if (now > Math.pow(2, 48) - 1) {
    throw createError('Time must be less than 2^48');
  }
  if (now < 0) {
    throw createError('Time must be positive');
  }
  let str = '';
  for (; len > 0; len--) {
    const mod = now % ENCODING_LEN;
    str = ENCODING.charAt(mod) + str;
    now = (now - mod) / ENCODING_LEN;
  }
  return str;
}

function encodeRandom(len, prng) {
  let str = '';
  for (; len > 0; len--) {
    str += randomChar(prng);
  }
  return str;
}

// Default PRNG using Math.random() - safe for React Native
function mathRandomPrng() {
  return Math.random();
}

// Factory to create a ulid function with a specific PRNG
function factory(currPrng) {
  if (!currPrng) {
    currPrng = mathRandomPrng;
  }
  return function ulid(seedTime) {
    if (isNaN(seedTime)) {
      seedTime = Date.now();
    }
    return encodeTime(seedTime, TIME_LEN) + encodeRandom(RANDOM_LEN, currPrng);
  };
}

// Factory for monotonic ULIDs (guarantees increasing order within same millisecond)
function monotonicFactory(currPrng) {
  if (!currPrng) {
    currPrng = mathRandomPrng;
  }
  let lastTime = 0;
  let lastRandom;
  return function ulid(seedTime) {
    if (isNaN(seedTime)) {
      seedTime = Date.now();
    }
    if (seedTime <= lastTime) {
      const incrementedRandom = (lastRandom = incrementBase32(lastRandom));
      return encodeTime(lastTime, TIME_LEN) + incrementedRandom;
    }
    lastTime = seedTime;
    const newRandom = (lastRandom = encodeRandom(RANDOM_LEN, currPrng));
    return encodeTime(seedTime, TIME_LEN) + newRandom;
  };
}

// Decode ULID time component
function decodeTime(id) {
  if (id.length !== TIME_LEN + RANDOM_LEN) {
    throw createError('Invalid ULID length');
  }
  const time = id
    .substr(0, TIME_LEN)
    .split('')
    .reverse()
    .reduce((carry, char, index) => {
      const charIndex = ENCODING.indexOf(char);
      if (charIndex === -1) {
        throw createError('Invalid ULID character');
      }
      return carry + charIndex * Math.pow(ENCODING_LEN, index);
    }, 0);
  if (time > Math.pow(2, 48) - 1) {
    throw createError('Invalid ULID time');
  }
  return time;
}

// Check if string is valid ULID
function isValid(id) {
  if (typeof id !== 'string' || id.length !== TIME_LEN + RANDOM_LEN) {
    return false;
  }
  return id.split('').every((char) => ENCODING.indexOf(char) !== -1);
}

// Create the default ulid function
const ulid = factory();

// Export all functions
module.exports = {
  ulid,
  factory,
  monotonicFactory,
  decodeTime,
  isValid,
  encodeTime,
  encodeRandom,
  incrementBase32,
  randomChar,
  replaceCharAt,
  ENCODING,
  ENCODING_LEN,
  TIME_LEN,
  RANDOM_LEN,
};
