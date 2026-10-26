// The Last Ferry — test story.
// Lines starting with a character id or name ("tomo:") are spoken by that character.
// A tag naming a portrait (#happy) sets their expression. #give:item / #take:item change the inventory.
// VARs with the same names as story.json flags stay in sync with the game.

VAR arrived = false
VAR talked_to_tomo = false
VAR helped_ferryman = false
VAR knows_code = false

=== arrival ===
The last light is leaving the harbour. Somewhere across the water is the island.
mira: If I miss the ferry tonight, I miss everything. #worried
-> DONE

=== tomo ===
{ talked_to_tomo:
    tomo: Still here? That lock won't open itself. #grumpy
    -> DONE
}
~ talked_to_tomo = true
tomo: Evening. The ferry's chained for the night.
mira: Please, I have to cross tonight. #worried
tomo: And I have to mend my net before the tide turns. #grumpy
* [Offer to help with the net]
    mira: Then let me help. What do you need? #happy
    tomo: ...Rope. There's some in my tackle box. Combination's my age. Seventy-two. #surprised
    ~ helped_ferryman = true
* [Insist on crossing now]
    mira: I don't have time for nets. #worried
    tomo: Then find your own way, traveller. #grumpy
- -> DONE

=== got_rope ===
mira: Rope. Tomo will be pleased. #happy
-> DONE

=== tomo_rope ===
tomo: You found it. Good. #happy #take:rope
tomo: A deal's a deal. The ferry's code is painted on my old lantern. Look closely.
~ knows_code = true
-> DONE

=== lantern ===
Painted on the glass: three stars, then one, then four.
mira: Three, one, four. #thinking
-> DONE

=== notice ===
A torn timetable flaps on the board. "Ferry lock reset. New code: the first digits of the circle."
mira: The circle... pi? Three, one, four. #thinking
-> DONE

=== ferry_locked ===
A heavy chain and a brass lock. Maybe the ferryman can help.
-> DONE

=== farewell ===
The chain falls away, and the ferry drifts out into the dark water.
{ helped_ferryman:
    tomo: Safe crossing, Mira! Come back and tell me about the island. #happy
- else:
    Behind her, the ferryman watches in silence.
}
mira: The island. Finally. #happy
-> DONE
