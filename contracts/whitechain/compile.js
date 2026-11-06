const fs = require('fs');
const path = require('path');
const solc = require('solc');

function findImports(importPath) {
  if (importPath.startsWith('@openzeppelin/contracts/')) {
    const relPath = importPath.replace('@openzeppelin/contracts/', '');
    const fullPath = path.resolve(__dirname, 'lib/openzeppelin-contracts/contracts', relPath);
    if (fs.existsSync(fullPath)) {
      return { contents: fs.readFileSync(fullPath, 'utf8') };
    }
  }
  const localPath = path.resolve(__dirname, 'src', importPath);
  if (fs.existsSync(localPath)) {
    return { contents: fs.readFileSync(localPath, 'utf8') };
  }
  return { error: 'File not found: ' + importPath };
}

const contractSource = fs.readFileSync(path.resolve(__dirname, 'src/PulsePayMerchantHub.sol'), 'utf8');

const input = {
  language: 'Solidity',
  sources: {
    'PulsePayMerchantHub.sol': {
      content: contractSource,
    },
  },
  settings: {
    optimizer: {
      enabled: true,
      runs: 200,
    },
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode'],
      },
    },
  },
};

console.log('Compiling PulsePayMerchantHub.sol with solc 0.8.26...');
const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

if (output.errors) {
  let hasError = false;
  for (const error of output.errors) {
    console.log(error.formattedMessage);
    if (error.severity === 'error') hasError = true;
  }
  if (hasError) process.exit(1);
}

const contract = output.contracts['PulsePayMerchantHub.sol']['PulsePayMerchantHub'];
const bytecode = '0x' + contract.evm.bytecode.object;
const abi = contract.abi;

fs.mkdirSync(path.resolve(__dirname, 'build'), { recursive: true });
fs.writeFileSync(path.resolve(__dirname, 'build/PulsePayMerchantHub.json'), JSON.stringify({ abi, bytecode }, null, 2));

console.log('Compilation successful!');
console.log('Bytecode length:', bytecode.length);
