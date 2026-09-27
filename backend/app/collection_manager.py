import os
import threading
from contextlib import contextmanager
from anki.collection import Collection

class CollectionManager:
    def __init__(self, path: str):
        self.path = path
        self.collection = None
        self.lock = threading.Lock()
        
    def open(self):
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        self.collection = Collection(self.path)
        self._ensure_models()
        
    def close(self):
        if self.collection:
            self.collection.close()
            self.collection = None
            
    def close_for_sync(self):
        with self.lock:
            self.close()
            
    def reopen_after_sync(self):
        with self.lock:
            self.open()

    @contextmanager
    def get_collection(self):
        with self.lock:
            if not self.collection:
                self.open()
            yield self.collection
            
    def _ensure_models(self):
        if not self.collection:
            return
            
        models_to_create = [
            {
                "name": "FC_TypeAnswer",
                "fields": ["Front", "Back", "Language"],
                "templates": [
                    {
                        "name": "Card 1",
                        "qfmt": "{{Front}}",
                        "afmt": '{{FrontSide}}<hr id="answer">{{Back}}'
                    }
                ]
            },
            {
                "name": "FC_MultipleChoice",
                "fields": ["Question", "CorrectAnswer", "WrongAnswer1", "WrongAnswer2", "WrongAnswer3", "Language"],
                "templates": [
                    {
                        "name": "Card 1",
                        "qfmt": "{{Question}}",
                        "afmt": '{{FrontSide}}<hr id="answer">{{CorrectAnswer}}'
                    }
                ]
            },
            {
                "name": "FC_ScrambledSentence",
                "fields": ["Sentence", "Translation", "Language"],
                "templates": [
                    {
                        "name": "Card 1",
                        "qfmt": "{{Translation}}",
                        "afmt": '{{FrontSide}}<hr id="answer">{{Sentence}}'
                    }
                ]
            },
            {
                "name": "FC_Dictation",
                "fields": ["AudioText", "Translation", "Language"],
                "templates": [
                    {
                        "name": "Card 1",
                        "qfmt": "{{#Translation}}<div class=\"hint\">Pista: {{Translation}}</div>{{/Translation}}",
                        "afmt": '{{FrontSide}}<hr id="answer">{{AudioText}}'
                    }
                ]
            }
        ]
        
        for model_data in models_to_create:
            existing = self.collection.models.by_name(model_data["name"])
            if not existing:
                model = self.collection.models.new(model_data["name"])
                for field_name in model_data["fields"]:
                    field = self.collection.models.new_field(field_name)
                    self.collection.models.add_field(model, field)
                
                for template_data in model_data["templates"]:
                    template = self.collection.models.new_template(template_data["name"])
                    template["qfmt"] = template_data["qfmt"]
                    template["afmt"] = template_data["afmt"]
                    self.collection.models.add_template(model, template)
                    
                self.collection.models.add(model)
            else:
                existing_flds = [f["name"] for f in existing["flds"]]
                added = False
                for field_name in model_data["fields"]:
                    if field_name not in existing_flds:
                        field = self.collection.models.new_field(field_name)
                        self.collection.models.add_field(existing, field)
                        added = True
                if added:
                    self.collection.models.save(existing)
