import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { RefetchOptions, QueryObserverResult } from '@tanstack/react-query';
import clsx from 'clsx';
import { ReadContractErrorType, TransactionExecutionError, parseEther } from 'viem';
import { useSimulateContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { useAccount } from 'wagmi';
import Button from '../../../../components/Button/Button';
import { useBuyMeACoffeeContract } from '../../../../hooks/contracts';
import { useLoggedInUserCanAfford } from '../../../../hooks/useUserCanAfford';
import { TransactionSteps } from '../../ContractDemo';
import OutOfGasStep from '../OutOfGasStep';
import StartTransactionStep from '../StartTransactionStep';
import TransactionCompleteStep from '../TransactionCompleteStep';

type FormBuyCoffeeProps = {
  setTransactionStep: React.Dispatch<React.SetStateAction<TransactionSteps | null>>;
  numCoffees: number;
  setNumCoffees: React.Dispatch<React.SetStateAction<number>>;
  transactionStep: TransactionSteps | null;
  refetchMemos: (options?: RefetchOptions | undefined) => Promise<
    QueryObserverResult<
      readonly {
        numCoffees: bigint;
        userName: string;
        expireDateHandle: string;
        message: string;
        time: bigint;
        userAddress: `0x${string}`;
      }[],
      ReadContractErrorType
    >
  >;
};

const BUY_COFFEE_AMOUNT_RAW = 0.0001;

function FormBuyCoffee({
  setTransactionStep,
  numCoffees,
  setNumCoffees,
  transactionStep,
  refetchMemos,
}: FormBuyCoffeeProps) {
  // Component state
  const [quantity, setQuantity] = useState('');
  const [expireDate, setExpireDateHandle] = useState('');
  const [message, setMessage] = useState('');
  const [buyCoffeeAmount, setBuyCoffeeAmount] = useState(BUY_COFFEE_AMOUNT_RAW);
  const [dataHash, setDataHash] = useState<string | undefined>();


  // Get the correct contract info for current network (if present)
  const contract = useBuyMeACoffeeContract();

  // Calculate if the user can afford to buy coffee
  const canAfford = useLoggedInUserCanAfford(parseEther(String(buyCoffeeAmount)));

  const handleOncomplete = useCallback(async () => {
    await refetchMemos();
  }, [refetchMemos]);

  const {address, addresses} = useAccount()

  const milisecondDate = Date.parse(expireDate)
  console.log(quantity, address, expireDate, milisecondDate, message)
  console.log(parseFloat(quantity))
  // Wagmi Write call
  const { data: buyCoffeeData } = useSimulateContract({
    address: contract.status === 'ready' ? contract.address : undefined,
    abi: contract.abi,
    functionName: 'buyCoffee',
    //args: [address, parseFloat(quantity), milisecondDate ],
    query: {
      enabled: message !== '' && contract.status === 'ready',
    },
    value: parseEther(String(buyCoffeeAmount)),
  });

  const {
    writeContract: buyMeACoffee,
    data: dataBuyMeACoffee,
    status: statusBuyMeACoffee,
    error: errorBuyMeACoffee,
  } = useWriteContract();

  const { status: transactionStatus } = useWaitForTransactionReceipt({
    hash: dataBuyMeACoffee,
    query: {
      enabled: !!dataBuyMeACoffee,
    },
  });

  useEffect(() => {
    async function handleTransactionStatus() {
      if (transactionStatus === 'error' && dataHash !== '') {
        await handleOncomplete();
        setDataHash('');
        setQuantity('')
        setExpireDateHandle('');
        setMessage('');
        if (
          errorBuyMeACoffee instanceof TransactionExecutionError &&
          errorBuyMeACoffee.message.toLowerCase().includes('out of gas')
        ) {
          setTransactionStep(TransactionSteps.OUT_OF_GAS_STEP);
        } else {
          setTransactionStep(null);
        }
      } else if (transactionStatus === 'success' && dataHash !== '') {
        await handleOncomplete();
        setDataHash('');
        setQuantity('')
        setExpireDateHandle('');
        setMessage('');
        setTransactionStep(TransactionSteps.TRANSACTION_COMPLETE_STEP);
      }
    }
    void handleTransactionStatus();
  }, [
    dataHash,
    errorBuyMeACoffee,
    handleOncomplete,
    setTransactionStep,
    statusBuyMeACoffee,
    transactionStatus,
  ]);

  const handleSubmit = useCallback(
    (event: { preventDefault: () => void }) => {
      event.preventDefault();
      if (buyCoffeeData?.request) {
        buyMeACoffee?.(buyCoffeeData?.request);
        setTransactionStep(TransactionSteps.START_TRANSACTION_STEP);
        setDataHash(dataBuyMeACoffee);
      } else {
        setTransactionStep(null);
      }
    },
    [buyCoffeeData?.request, buyMeACoffee, dataBuyMeACoffee, setTransactionStep],
  );


  const handleQuantityChange = useCallback(
    (event: { target: { value: React.SetStateAction<string> } }) => {
      setQuantity(event.target.value);
    },
    [setQuantity],
  );
  const handleExpireDateHandleChange = useCallback(
    (event: { target: { value: React.SetStateAction<string> } }) => {
      setExpireDateHandle(event.target.value);
    },
    [setExpireDateHandle],
  );

  const handleMessageChange = useCallback(
    (event: { target: { value: React.SetStateAction<string> } }) => {
      setMessage(event.target.value);
    },
    [setMessage],
  );

  const formDisabled = useMemo(() => {
    return contract.status !== 'ready' || statusBuyMeACoffee === 'pending' || !canAfford;
  }, [canAfford, contract.status, statusBuyMeACoffee]);

  const submitButtonContent = useMemo(() => {
    return (
      <>
        Send Verification {String(buyCoffeeAmount.toFixed(4))} ETH
      </>
    );
  }, [buyCoffeeAmount]);

  const warningContent = useMemo(() => {
    if (contract.status === 'notConnected') {
      return <>Please connect your wallet to continue.</>;
    }

    if (!canAfford) {
      return (
        <>You must have at least {String(BUY_COFFEE_AMOUNT_RAW)} ETH in your wallet to continue.</>
      );
    }

    if (contract.status === 'onUnsupportedNetwork') {
      return (
        <>
          Please connect to one of the supported networks to continue:{' '}
          {contract.supportedChains.map((c) => c.name).join(', ')}
        </>
      );
    }

    if (contract.status === 'deactivated') {
      return <>This contract has been deactivated on this chain.</>;
    }

    return null;
  }, [canAfford, contract.status, contract.supportedChains]);

  return (
    <>
      {transactionStep === TransactionSteps.START_TRANSACTION_STEP && <StartTransactionStep />}

      {transactionStep === TransactionSteps.TRANSACTION_COMPLETE_STEP && (
        <TransactionCompleteStep numCoffees={numCoffees} setTransactionStep={setTransactionStep} />
      )}

      {transactionStep === TransactionSteps.OUT_OF_GAS_STEP && (
        <OutOfGasStep buyCoffeeAmountRaw={0.001} setTransactionStep={setTransactionStep} />
      )}

      {transactionStep === null && (
        <>
          <h2 className="mb-5 w-full text-center text-2xl font-semibold text-white lg:text-left">
            Verify Crypto Bets!
          </h2>
          <form onSubmit={handleSubmit} className="w-full">
            <div>
              <div className="mb-5">
                <label htmlFor="quantity" className="mb-2 block text-sm font-medium text-white">
                  Quantity Threshold
                </label>
                <input
                  type="number"
                  id="quantity"
                  className={clsx([
                    'block w-full rounded-lg border border-gray-600 bg-boat-color-gray-900',
                    'p-2 text-sm text-white placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500',
                  ])}
                  placeholder="Quantity"
                  onChange={handleQuantityChange}
                  step={0.001}
                  disabled={formDisabled}

                  required
                />
              </div>
            </div>

            <div>
              <div className="mb-5">
                <label
                  htmlFor="expireDateHandle"
                  className="mb-2 block text-sm font-medium text-white"
                >
                  Expire Date
                </label>
                <input
                  type="date"
                  id="expireDateHandle"
                  className={clsx([
                    'block w-full rounded-lg border border-gray-600 bg-boat-color-gray-900',
                    'p-2 text-sm text-white placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500',
                  ])}
                  onChange={handleExpireDateHandleChange}
                  disabled={formDisabled}
                />
              </div>

              <div className="mb-5">
                <label htmlFor="message" className="mb-2 block text-sm font-medium text-white">
                  Message
                </label>
                <textarea
                  value={message}
                  id="message"
                  className={clsx([
                    'block w-full rounded-lg border border-gray-600 bg-boat-color-gray-900',
                    'p-2 text-sm text-white placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500',
                  ])}
                  placeholder="Say something"
                  onChange={handleMessageChange}
                  disabled={formDisabled}
                  required
                />
              </div>

              {warningContent ? (
                <div className="my-3 flex items-center justify-center">
                  <div className="mr-2">
                    <ExclamationTriangleIcon width={12} height={12} />
                  </div>
                  <div className="text-xs">{warningContent}</div>
                </div>
              ) : null}

              <Button buttonContent={submitButtonContent} type="submit" disabled={formDisabled || !expireDate || quantity == "" || quantity == "0"} />
            </div>
          </form>
        </>
      )}
    </>
  );
}

export default FormBuyCoffee;
