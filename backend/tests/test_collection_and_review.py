import os
import tempfile
import pytest
from app.collection_manager import CollectionManager

@pytest.fixture
def manager():
    temp_dir = tempfile.mkdtemp()
    db_path = os.path.join(temp_dir, "test.anki2")
    cm = CollectionManager(db_path)
    cm.open()
    yield cm
    cm.close()

def test_collection_manager_creates_custom_models(manager):
    with manager.get_collection() as col:
        # Check standard models
        assert col.models.by_name("Basic") is not None
        assert col.models.by_name("Basic (and reversed card)") is not None

        # Check our 3 custom models
        assert col.models.by_name("FC_TypeAnswer") is not None
        assert col.models.by_name("FC_MultipleChoice") is not None
        assert col.models.by_name("FC_ScrambledSentence") is not None

def test_create_and_review_all_five_card_types(manager):
    with manager.get_collection() as col:
        deck_id = col.decks.id("Test Deck")

        # 1. Basic Note
        m_basic = col.models.by_name("Basic")
        n1 = col.new_note(m_basic)
        n1.fields[0] = "¿Qué es FSRS?"
        n1.fields[1] = "Free Spaced Repetition Scheduler"
        col.add_note(n1, deck_id)

        # 2. Basic Reversed Note (generates 2 cards)
        m_rev = col.models.by_name("Basic (and reversed card)")
        n2 = col.new_note(m_rev)
        n2.fields[0] = "Apple"
        n2.fields[1] = "Manzana"
        col.add_note(n2, deck_id)

        # 3. Type Answer Note
        m_type = col.models.by_name("FC_TypeAnswer")
        n3 = col.new_note(m_type)
        n3.fields[0] = "Dog"
        n3.fields[1] = "Perro"
        n3.fields[2] = "es-ES"
        col.add_note(n3, deck_id)

        # 4. Multiple Choice Note
        m_mc = col.models.by_name("FC_MultipleChoice")
        n4 = col.new_note(m_mc)
        n4.fields[0] = "¿Cuál es un felino?"
        n4.fields[1] = "Gato"
        n4.fields[2] = "Perro"
        n4.fields[3] = "Loro"
        n4.fields[4] = "Vaca"
        n4.fields[5] = "es-ES"
        col.add_note(n4, deck_id)

        # 5. Scrambled Sentence Note
        m_scramble = col.models.by_name("FC_ScrambledSentence")
        n5 = col.new_note(m_scramble)
        n5.fields[0] = "El gato bebe leche"
        n5.fields[1] = "The cat drinks milk"
        n5.fields[2] = "es-ES"
        col.add_note(n5, deck_id)

        # Total cards in deck should be 1 + 2 + 1 + 1 + 1 = 6 cards!
        card_ids = col.find_cards('deck:"Test Deck"')
        assert len(card_ids) == 6

        # Now test answering one card with Good (rating 3) using FSRS scheduler
        first_card = col.get_card(card_ids[0])
        initial_reps = first_card.reps

        states = col._backend.get_scheduling_states(first_card.id)
        assert states is not None
        labels = [l.replace('\u2068', '').replace('\u2069', '') for l in col.sched.describe_next_states(states)]
        assert len(labels) == 4

        first_card.start_timer()
        card_answer = col.sched.build_answer(card=first_card, states=states, rating=3)
        col.sched.answer_card(card_answer)

        updated_card = col.get_card(card_ids[0])
        assert updated_card.reps == initial_reps + 1
