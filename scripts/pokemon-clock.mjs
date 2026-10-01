const realNow = Date.now;
const offset = 350000 - (realNow() % 600000);
Date.now = () => realNow() + offset;
