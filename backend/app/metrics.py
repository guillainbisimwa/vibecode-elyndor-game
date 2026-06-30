from typing import Optional
from google.adk.evaluation.eval_case import Invocation
from google.adk.evaluation.eval_metrics import EvalMetric, EvalStatus
from google.adk.evaluation.conversation_scenarios import ConversationScenario
from google.adk.evaluation.evaluator import EvaluationResult, PerInvocationResult

def dark_fantasy_alignment(
    eval_metric: EvalMetric,
    actual_invocations: list[Invocation],
    expected_invocations: Optional[list[Invocation]] = None,
    conversation_scenario: Optional[ConversationScenario] = None,
) -> EvaluationResult:
    """Evaluates how well character dialogue matches a dark-fantasy elven RPG tone.
    Checks for the absence of generic AI assistant phrases and presence of thematic keywords.
    Does not require a golden reference response, allowing robust offline testing.
    """
    per_invocation_results = []
    total_score = 0.0
    
    # Dark fantasy keywords
    thematic_keywords = {
        "void", "shadow", "ruin", "eldergate", "dark", "corrupt", "sage", "ancient", 
        "doom", "whisper", "aether", "abyss", "cursed", "crypt", "rebel", "blood",
        "soul", "light", "fate", "broken", "silent", "sorrow", "echo"
    }
    
    # Modern AI assistant phrases (clichés) to penalize
    assistant_phrases = {
        "as an ai", "i can help", "of course", "how can i assist", "here is", "surely",
        "is there anything else", "happy to help", "what would you like"
    }

    for i, actual in enumerate(actual_invocations):
        text = "".join(part.text for part in actual.final_response.parts if part.text).lower()
        
        # Determine score
        score = 0.5  # Neutral baseline
        
        # Reward thematic keywords
        words = text.split()
        keyword_hits = sum(1 for w in words if any(kw in w for kw in thematic_keywords))
        if keyword_hits >= 2:
            score += 0.35
        elif keyword_hits >= 1:
            score += 0.20
            
        # Penalize modern assistant vocabulary or typical polite chatter
        for phrase in assistant_phrases:
            if phrase in text:
                score -= 0.45
                
        # Clamp score to [0.0, 1.0]
        score = max(0.0, min(1.0, score))
        total_score += score
        
        # Determine status based on the threshold
        threshold = eval_metric.threshold if eval_metric.threshold is not None else 0.6
        status = EvalStatus.PASSED if score >= threshold else EvalStatus.FAILED
        
        expected = expected_invocations[i] if expected_invocations and i < len(expected_invocations) else None
        
        per_invocation_results.append(
            PerInvocationResult(
                actual_invocation=actual,
                expected_invocation=expected,
                score=score,
                eval_status=status
            )
        )
        
    avg_score = total_score / len(actual_invocations) if actual_invocations else 0.0
    overall_threshold = eval_metric.threshold if eval_metric.threshold is not None else 0.6
    overall_status = EvalStatus.PASSED if avg_score >= overall_threshold else EvalStatus.FAILED
    
    return EvaluationResult(
        overall_score=avg_score,
        overall_eval_status=overall_status,
        per_invocation_results=per_invocation_results
    )
