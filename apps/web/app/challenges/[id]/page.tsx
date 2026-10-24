'use client';
import { use } from 'react';
import { ChallengeGame } from '../../../components/ChallengeGame';

export default function ChallengePage({params}:{params:Promise<{id:string}>}) {
  const {id}=use(params);
  return <ChallengeGame id={id}/>;
}
