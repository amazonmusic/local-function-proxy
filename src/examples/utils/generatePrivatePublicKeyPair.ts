import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const keyPair = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem',
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
  },
});

const dirPath = path.join(process.cwd(), './credentials');
if (!fs.existsSync(dirPath)) {
  fs.mkdirSync(dirPath, { recursive: true });
}

fs.writeFileSync(dirPath + '/testKey.pem', keyPair.privateKey);
fs.writeFileSync(dirPath + '/testCert.pem', keyPair.publicKey);

console.log('Private Public Key Pair generated!!\n');
