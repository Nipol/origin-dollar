import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'
import { BigNumber } from 'ethers'

import AccountStore from 'stores/AccountStore'
import YieldStore from 'stores/YieldStore'
import { animateValue } from 'utils/animation'
import { usePrevious } from 'utils/hooks'

const useExpectedYield = () => {
  const mintAnimationLimit = 0.01

  const currentCreditsPerToken = useStoreState(
    YieldStore,
    (s) => s.currentCreditsPerToken
  )
  const nextCreditsPerToken = useStoreState(
    YieldStore,
    (s) => s.nextCreditsPerToken
  )
  const expectedIncrease = useStoreState(YieldStore, (s) => s.expectedIncrease)
  const animatedExpectedIncrease = useStoreState(
    YieldStore,
    (s) => s.animatedExpectedIncrease
  )

  const creditsBalanceOf = useStoreState(
    AccountStore,
    (s) => s.creditsBalanceOf
  )
  const prevExpectedIncrease = usePrevious(expectedIncrease)

  const expectedIncreaseAnimation = (from, to) => {
    const values = [parseFloat(from) || 0, parseFloat(to)]
    let [startVal, endVal] = values

    const reverseOrder = startVal > endVal
    if (reverseOrder) {
      ;[endVal, startVal] = values
    }

    return animateValue({
      from: startVal,
      to: endVal,
      callbackValue: (val) => {
        let adjustedValue = val
        if (reverseOrder) {
          adjustedValue = endVal - val + startVal
        }

        YieldStore.update((s) => {
          s.animatedExpectedIncrease = Number(adjustedValue.toFixed(2))
        })
      },
      onCompleteCallback: () => {},
      // non even duration number so more of the decimals in ousdBalance animate
      duration: 1985,
      id: 'expected-increase-animation',
      stepTime: 30,
    })
  }

  useEffect(() => {
    const expectedIncreaseNum = parseFloat(expectedIncrease)
    const prevExpectedIncreaseNum = parseFloat(prevExpectedIncrease)
    // user must have minted the OUSD
    if (
      typeof expectedIncreaseNum === 'number' &&
      typeof prevExpectedIncreaseNum === 'number' &&
      Math.abs(expectedIncreaseNum - prevExpectedIncreaseNum) >
        mintAnimationLimit
    ) {
      expectedIncreaseAnimation(prevExpectedIncreaseNum, expectedIncreaseNum)
    } else if (typeof expectedIncreaseNum === 'number') {
      expectedIncreaseAnimation(0, expectedIncreaseNum)
    }
  }, [expectedIncrease])

  useEffect(() => {
    const yields =
      parseFloat(creditsBalanceOf / nextCreditsPerToken) -
      parseFloat(creditsBalanceOf / currentCreditsPerToken)
    YieldStore.update((s) => {
      s.expectedIncrease = Math.max(0, yields)
    })
  }, [creditsBalanceOf, currentCreditsPerToken, nextCreditsPerToken])

  return {
    animatedExpectedIncrease,
  }
}

export default useExpectedYield