// Generated ABI for PulsePayMerchantHub
export const pulsePayMerchantHubAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "_usdt",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_defaultReserveBps",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "BPS_DIVISOR",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "USDT",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IERC20"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "cancelInvoice",
    "inputs": [
      {
        "name": "invoiceId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "cancelSubscription",
    "inputs": [
      {
        "name": "subscriptionId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "chargeRenewal",
    "inputs": [
      {
        "name": "subscriptionId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "renewalId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "createInvoice",
    "inputs": [
      {
        "name": "invoiceId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "customer",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "dueAt",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "metadataHash",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "createPlan",
    "inputs": [
      {
        "name": "planId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "amountPerCycle",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "intervalSeconds",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "maxCycles",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "createSubscription",
    "inputs": [
      {
        "name": "subscriptionId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "planId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "defaultReserveBps",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "fundRefundReserve",
    "inputs": [
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getInvoice",
    "inputs": [
      {
        "name": "invoiceId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct PulsePayMerchantHub.Invoice",
        "components": [
          {
            "name": "invoiceId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "merchant",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "customer",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "amount",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "dueAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "status",
            "type": "uint8",
            "internalType": "enum PulsePayMerchantHub.InvoiceStatus"
          },
          {
            "name": "metadataHash",
            "type": "bytes32",
            "internalType": "bytes32"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getMerchantBalances",
    "inputs": [
      {
        "name": "merchant",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "reserve",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "available",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getMerchantReserveBps",
    "inputs": [
      {
        "name": "_merchant",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getPayment",
    "inputs": [
      {
        "name": "invoiceId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct PulsePayMerchantHub.Payment",
        "components": [
          {
            "name": "invoiceId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "merchant",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "customer",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "amountPaid",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "amountRefunded",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "paidAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "status",
            "type": "uint8",
            "internalType": "enum PulsePayMerchantHub.PaymentStatus"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getPlan",
    "inputs": [
      {
        "name": "planId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct PulsePayMerchantHub.SubscriptionPlan",
        "components": [
          {
            "name": "planId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "merchant",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "amountPerCycle",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "intervalSeconds",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "maxCycles",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "active",
            "type": "bool",
            "internalType": "bool"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getSubscription",
    "inputs": [
      {
        "name": "subscriptionId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct PulsePayMerchantHub.Subscription",
        "components": [
          {
            "name": "subscriptionId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "planId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "merchant",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "subscriber",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "amountPerCycle",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "intervalSeconds",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "nextChargeAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "maxCycles",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "cyclesCharged",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "active",
            "type": "bool",
            "internalType": "bool"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "invoices",
    "inputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "invoiceId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "merchant",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "customer",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "dueAt",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "status",
        "type": "uint8",
        "internalType": "enum PulsePayMerchantHub.InvoiceStatus"
      },
      {
        "name": "metadataHash",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "issueRefund",
    "inputs": [
      {
        "name": "invoiceId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "refundAmount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "reasonHash",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "merchantAvailable",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "merchantCustomReserveBps",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "payInvoice",
    "inputs": [
      {
        "name": "invoiceId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "payments",
    "inputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "invoiceId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "merchant",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "customer",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "amountPaid",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "amountRefunded",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "paidAt",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "status",
        "type": "uint8",
        "internalType": "enum PulsePayMerchantHub.PaymentStatus"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "plans",
    "inputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "planId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "merchant",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "amountPerCycle",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "intervalSeconds",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "maxCycles",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "active",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "processedRenewals",
    "inputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "refundReserve",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "renounceOwnership",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setDefaultReserveBps",
    "inputs": [
      {
        "name": "_newBps",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setMerchantReserveBps",
    "inputs": [
      {
        "name": "_newBps",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "subscriptions",
    "inputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "subscriptionId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "planId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "merchant",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "subscriber",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "amountPerCycle",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "intervalSeconds",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "nextChargeAt",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "maxCycles",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "cyclesCharged",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "active",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "transferOwnership",
    "inputs": [
      {
        "name": "newOwner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "withdrawAvailable",
    "inputs": [
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "to",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "DefaultReserveBpsUpdated",
    "inputs": [
      {
        "name": "oldBps",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "newBps",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "InvoiceCancelled",
    "inputs": [
      {
        "name": "invoiceId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "merchant",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "InvoiceCreated",
    "inputs": [
      {
        "name": "invoiceId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "merchant",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "customer",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "dueAt",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "metadataHash",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MerchantReserveBpsUpdated",
    "inputs": [
      {
        "name": "merchant",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newBps",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MerchantWithdrawal",
    "inputs": [
      {
        "name": "merchant",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "recipient",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OwnershipTransferred",
    "inputs": [
      {
        "name": "previousOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PaymentSettled",
    "inputs": [
      {
        "name": "invoiceId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "merchant",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "customer",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "paidAt",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PlanCreated",
    "inputs": [
      {
        "name": "planId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "merchant",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amountPerCycle",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "intervalSeconds",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "maxCycles",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RefundIssued",
    "inputs": [
      {
        "name": "invoiceId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "merchant",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "customer",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "cumulativeRefund",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "reasonHash",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RefundReserveFunded",
    "inputs": [
      {
        "name": "merchant",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "newReserveBalance",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SubscriptionCancelled",
    "inputs": [
      {
        "name": "subscriptionId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "cancelledBy",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SubscriptionCreated",
    "inputs": [
      {
        "name": "subscriptionId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "planId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "merchant",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "subscriber",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "amountPerCycle",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "nextChargeAt",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SubscriptionRenewed",
    "inputs": [
      {
        "name": "subscriptionId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "renewalId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "cycleNumber",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "nextChargeAt",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "DuplicateRenewal",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InsufficientAvailableBalance",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InsufficientRefundLiquidity",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidAmount",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidExpiry",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidReserveBps",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvoiceAlreadyExists",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvoiceExpired",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvoiceNotFound",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvoiceNotOpen",
    "inputs": []
  },
  {
    "type": "error",
    "name": "OwnableInvalidOwner",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "OwnableUnauthorizedAccount",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "PaymentAlreadySettled",
    "inputs": []
  },
  {
    "type": "error",
    "name": "PaymentNotFound",
    "inputs": []
  },
  {
    "type": "error",
    "name": "PlanAlreadyExists",
    "inputs": []
  },
  {
    "type": "error",
    "name": "PlanInactive",
    "inputs": []
  },
  {
    "type": "error",
    "name": "PlanNotFound",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ReentrancyGuardReentrantCall",
    "inputs": []
  },
  {
    "type": "error",
    "name": "RefundExceedsPaidAmount",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SafeERC20FailedOperation",
    "inputs": [
      {
        "name": "token",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "SubscriptionAlreadyExists",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SubscriptionCycleCapReached",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SubscriptionInactive",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SubscriptionNotDue",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SubscriptionNotFound",
    "inputs": []
  },
  {
    "type": "error",
    "name": "UnauthorizedCustomer",
    "inputs": []
  },
  {
    "type": "error",
    "name": "UnauthorizedMerchant",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ZeroAddress",
    "inputs": []
  }
] as const;

export const erc20Abi = [
  {
    type: "function",
    name: "name",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "transferFrom",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable"
  }
] as const;

export const whitechainCCIPBridgeAbi = [
  {
    type: "function",
    name: "bridgeTokens",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "destChainSelector", type: "uint64" },
      { name: "recipient", type: "address" },
      { name: "nonce", type: "uint256" },
      { name: "signature", type: "bytes" }
    ],
    outputs: [{ name: "depositId", type: "bytes32" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "getDepositHash",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "destChainSelector", type: "uint64" },
      { name: "recipient", type: "address" },
      { name: "nonce", type: "uint256" },
      { name: "sender", type: "address" }
    ],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "isDepositUsed",
    inputs: [{ name: "depositId", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "userNonces",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "mapper",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "authorizedSigner",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "signatureRequired",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "paused",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "pause",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "unpause",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "setAuthorizedSigner",
    inputs: [{ name: "newSigner", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "setSignatureRequired",
    inputs: [{ name: "required", type: "bool" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "withdrawTokenLiquidity",
    inputs: [
      { name: "token", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "event",
    name: "Deposit",
    inputs: [
      { name: "depositId", type: "bytes32", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "sender", type: "address", indexed: true },
      { name: "recipient", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "destChainSelector", type: "uint64", indexed: false },
      { name: "nonce", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false }
    ],
    anonymous: false
  }
] as const;

export const whitechainBridgeMapperAbi = [
  {
    type: "function",
    name: "getTokenConfig",
    inputs: [
      { name: "localToken", type: "address" },
      { name: "destChainSelector", type: "uint64" }
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "localToken", type: "address" },
          { name: "foreignToken", type: "address" },
          { name: "destChainSelector", type: "uint64" },
          { name: "transferType", type: "uint8" },
          { name: "minAmount", type: "uint256" },
          { name: "maxAmount", type: "uint256" },
          { name: "dailyLimit", type: "uint256" },
          { name: "currentDailyVolume", type: "uint256" },
          { name: "lastVolumeReset", type: "uint256" },
          { name: "isActive", type: "bool" }
        ]
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "isTokenSupported",
    inputs: [
      { name: "localToken", type: "address" },
      { name: "destChainSelector", type: "uint64" }
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getRemainingDailyLimit",
    inputs: [
      { name: "localToken", type: "address" },
      { name: "destChainSelector", type: "uint64" }
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  }
] as const;
