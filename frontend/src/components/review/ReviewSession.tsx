import React from 'react';
import { useReviewStore } from '../../stores/reviewStore';
import { BasicCard } from './BasicCard';
import { TypeAnswerCard } from './TypeAnswerCard';
import { MultipleChoiceCard } from './MultipleChoiceCard';
import { ScrambledSentenceCard } from './ScrambledSentenceCard';
import { DictationCard } from './DictationCard';

export function ReviewSession() {
  const { cards, currentIndex, answerCurrent, nextCard } = useReviewStore();

  const card = cards[currentIndex];

  if (!card) return null;

  const handleAnswer = async (rating: number) => {
    try {
      await answerCurrent(rating);
    } catch (err) {
      console.warn('Error guardando respuesta:', err);
    } finally {
      nextCard();
    }
  };

  const cardKey = `${card.card_id}-${currentIndex}`;
  const typeName = (card.note_type_name || '').toLowerCase();

  // 1. Dedicated Dictation Card
  if (
    typeName.includes('dictat') ||
    typeName.includes('dictad') ||
    typeName.includes('escuchar') ||
    typeName.includes('audio')
  ) {
    return (
      <DictationCard
        key={cardKey}
        card={card}
        onComplete={handleAnswer}
      />
    );
  }

  // 2. Type Answer
  if (
    typeName.includes('typeanswer') ||
    typeName.includes('escribir') ||
    typeName.includes('teclear')
  ) {
    return (
      <TypeAnswerCard
        key={cardKey}
        card={card}
        onComplete={handleAnswer}
      />
    );
  }

  // 3. Multiple Choice
  if (
    typeName.includes('multiplechoice') ||
    typeName.includes('opción') ||
    typeName.includes('opcion') ||
    typeName.includes('elección')
  ) {
    return (
      <MultipleChoiceCard
        key={cardKey}
        card={card}
        onComplete={handleAnswer}
      />
    );
  }

  // 4. Scrambled Sentence
  if (
    typeName.includes('scramble') ||
    typeName.includes('desordenada')
  ) {
    return (
      <ScrambledSentenceCard
        key={cardKey}
        card={card}
        onComplete={handleAnswer}
      />
    );
  }

  // 5. Default: Basic, Basic Reversed, etc.
  return (
    <BasicCard
      key={cardKey}
      card={card}
      onComplete={handleAnswer}
    />
  );
}
