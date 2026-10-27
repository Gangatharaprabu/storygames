// The Island Lighthouse — episode 2 of Mira's Journey (placeholder story).

VAR arrived = false
VAR talked_to_hana = false
VAR helped_ferryman = false

=== arrival ===
Sand, salt, and a lighthouse with no light.
mira: Mother's lighthouse. It's so dark. #worried
-> DONE

=== hana ===
{ talked_to_hana:
    hana: The door answers to the sky, child. Not to me.
    -> DONE
}
~ talked_to_hana = true
hana: A visitor? Nobody comes on the night ferry. #surprised
{ helped_ferryman:
    mira: Tomo brought me. He says hello. #happy
    hana: That old goat! Then you're welcome here. #happy
- else:
    mira: I came across tonight. Alone. #neutral
    hana: Hm. Few do. #worried
}
* [Ask about the lighthouse]
    mira: Why is the light out? #worried
    hana: The door sealed itself when your mother left. It opens to someone who reads the sky. #neutral
* [Ask about her mother]
    mira: Did you know my mother? #thinking
    hana: Know her? She taught me to read the sky. The door will remember her, too. #happy
- -> DONE

=== rock ===
Carved into the rock: a moon, then a scatter of stars, then a rising sun.
mira: Night, then stars, then dawn. #thinking
-> DONE

=== lamp ===
The door grinds open. Mira climbs the spiral stairs and lights the great lamp.
hana: Your mother used to stand exactly there. #happy
mira: Then I'll stand here too. For now. #happy
-> DONE
