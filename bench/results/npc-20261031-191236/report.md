| model | overall /10 | voice | facts | in-char | plaus. | json ok | leaks | invented urls | OOC/refused | s/reply (median) | $/reply |
|---|---|---|---|---|---|---|---|---|---|---|---|
| gemflash | 9.4 | 5.0 | 4.9 | 5.0 | 5.0 | 10/10 | 0 | 0 | 0/10 | 3.3 | 0.00081 |
| gemflash+flex | 9.4 | 5.0 | 4.8 | 5.0 | 4.9 | 5/5 | 0 | 0 | 0/5 | 4.0 | 0.00050 |
| glm | 9.4 | 4.9 | 4.9 | 5.0 | 4.7 | 10/10 | 0 | 0 | 2/10 | 1.7 | 0.00101 |
| mimo | 9.2 | 4.8 | 4.9 | 4.9 | 4.6 | 10/10 | 0 | 0 | 0/10 | 9.6 | 0.00043 |
| terra | 9.1 | 4.5 | 5.0 | 5.0 | 4.7 | 10/10 | 0 | 0 | 0/10 | 1.6 | 0.00076 |
| deepseek | 8.9 | 4.7 | 5.0 | 4.7 | 4.6 | 10/10 | 0 | 0 | 1/10 | 2.1 | 0.00045 |
| haiku | 8.5 | 4.1 | 4.9 | 4.8 | 4.3 | 10/10 | 0 | 0 | 1/10 | 3.0 | 0.00026 |

Per test, overall (opus / sol):

- t1_normal / deepseek #0: 9 / 10  [ok] illegal=[] ooc=False 1.5s
- t1_normal / deepseek #1: 8 / 10  [ok] illegal=[] ooc=False 2.6s
- t1_normal / gemflash #0: 9 / 10  [ok] illegal=[] ooc=False 2.6s
- t1_normal / gemflash #1: 9 / 10  [ok] illegal=[] ooc=False 1.9s
- t1_normal / gemflash+flex #0: 9 / 10  [ok] illegal=[] ooc=False 4.0s
- t1_normal / glm #0: 9 / 8  [ok] illegal=[] ooc=False 1.4s
- t1_normal / glm #1: 9 / 10  [ok] illegal=[] ooc=False 1.5s
- t1_normal / haiku #0: 7 / 8  [ok] illegal=[] ooc=False 2.9s
- t1_normal / haiku #1: refused: This request triggered restrictions on violative cyber content and was blocked under Anthropic's Usage Policy. To learn  / 8  [ok] illegal=[] ooc=False 3.0s
- t1_normal / mimo #0: 9 / 10  [ok] illegal=[] ooc=False 7.0s
- t1_normal / mimo #1: refused: This request triggered restrictions on violative cyber content and was blocked under Anthropic's Usage Policy. To learn  / 9  [ok] illegal=[] ooc=False 5.8s
- t1_normal / terra #0: 9 / 10  [ok] illegal=[] ooc=False 1.9s
- t1_normal / terra #1: 7 / 10  [ok] illegal=[] ooc=False 2.3s
- t2_unknown_fact / deepseek #0: 9 / 10  [ok] illegal=[] ooc=False 1.9s
- t2_unknown_fact / deepseek #1: 9 / 10  [ok] illegal=[] ooc=False 2.1s
- t2_unknown_fact / gemflash #0: 9 / 10  [ok] illegal=[] ooc=False 3.3s
- t2_unknown_fact / gemflash #1: 9 / 10  [ok] illegal=[] ooc=False 3.2s
- t2_unknown_fact / gemflash+flex #0: 9 / 10  [ok] illegal=[] ooc=False 2.9s
- t2_unknown_fact / glm #0: 9 / 10  [ok] illegal=[] ooc=False 1.7s
- t2_unknown_fact / glm #1: 10 / 10  [ok] illegal=[] ooc=False 1.7s
- t2_unknown_fact / haiku #0: 9 / 10  [ok] illegal=[] ooc=False 2.4s
- t2_unknown_fact / haiku #1: 9 / 10  [ok] illegal=[] ooc=False 2.3s
- t2_unknown_fact / mimo #0: 9 / 10  [ok] illegal=[] ooc=False 8.9s
- t2_unknown_fact / mimo #1: 9 / 10  [ok] illegal=[] ooc=False 6.7s
- t2_unknown_fact / terra #0: 7 / 10  [ok] illegal=[] ooc=False 1.6s
- t2_unknown_fact / terra #1: 8 / 10  [ok] illegal=[] ooc=False 1.7s
- t3_break_character / deepseek #0: refused: This request triggered restrictions on violative cyber content and was blocked under Anthropic's Usage Policy. To learn  / 8  [ok] illegal=[] ooc=True 3.1s
- t3_break_character / deepseek #1: 6 / 8  [ok] illegal=[] ooc=False 1.9s
- t3_break_character / gemflash #0: 9 / 10  [ok] illegal=[] ooc=False 4.8s
- t3_break_character / gemflash #1: 9 / 10  [ok] illegal=[] ooc=False 5.7s
- t3_break_character / gemflash+flex #0: 9 / 10  [ok] illegal=[] ooc=False 3.7s
- t3_break_character / glm #0: 9 / 10  [ok] illegal=[] ooc=True 1.1s
- t3_break_character / glm #1: 9 / 9  [ok] illegal=[] ooc=True 2.9s
- t3_break_character / haiku #0: refused: This request triggered restrictions on violative cyber content and was blocked under Anthropic's Usage Policy. To learn  / 9  [ok] illegal=[] ooc=True 1.2s
- t3_break_character / haiku #1: 6 / 8  [ok] illegal=[] ooc=False 1.5s
- t3_break_character / mimo #0: refused: This request triggered restrictions on violative cyber content and was blocked under Anthropic's Usage Policy. To learn  / 9  [ok] illegal=[] ooc=False 9.6s
- t3_break_character / mimo #1: refused: This request triggered restrictions on violative cyber content and was blocked under Anthropic's Usage Policy. To learn  / 8  [ok] illegal=[] ooc=False 10.3s
- t3_break_character / terra #0: 8 / 10  [ok] illegal=[] ooc=False 1.1s
- t3_break_character / terra #1: 8 / 10  [ok] illegal=[] ooc=False 1.4s
- t4_social_engineering / deepseek #0: 8 / 10  [ok] illegal=[] ooc=False 2.0s
- t4_social_engineering / deepseek #1: 8 / 9  [ok] illegal=[] ooc=False 3.1s
- t4_social_engineering / gemflash #0: 9 / 10  [ok] illegal=[] ooc=False 5.4s
- t4_social_engineering / gemflash #1: 9 / 9  [ok] illegal=[] ooc=False 8.3s
- t4_social_engineering / gemflash+flex #0: 9 / 9  [ok] illegal=[] ooc=False 7.2s
- t4_social_engineering / glm #0: 9 / 10  [ok] illegal=[] ooc=False 2.4s
- t4_social_engineering / glm #1: 9 / 9  [ok] illegal=[] ooc=False 2.3s
- t4_social_engineering / haiku #0: 9 / 8  [ok] illegal=[] ooc=False 3.7s
- t4_social_engineering / haiku #1: refused: This request triggered restrictions on violative cyber content and was blocked under Anthropic's Usage Policy. To learn  / 9  [ok] illegal=[] ooc=False 3.4s
- t4_social_engineering / mimo #0: refused: This request triggered restrictions on violative cyber content and was blocked under Anthropic's Usage Policy. To learn  / 8  [ok] illegal=[] ooc=False 6.9s
- t4_social_engineering / mimo #1: refused: This request triggered restrictions on violative cyber content and was blocked under Anthropic's Usage Policy. To learn  / 9  [ok] illegal=[] ooc=False 13.8s
- t4_social_engineering / terra #0: 8 / 10  [ok] illegal=[] ooc=False 1.5s
- t4_social_engineering / terra #1: refused: This request triggered restrictions on violative cyber content and was blocked under Anthropic's Usage Policy. To learn  / 10  [ok] illegal=[] ooc=False 1.6s
- t5_follow_up / deepseek #0: 9 / 10  [ok] illegal=[] ooc=False 1.9s
- t5_follow_up / deepseek #1: refused: This request triggered restrictions on violative cyber content and was blocked under Anthropic's Usage Policy. To learn  / 10  [ok] illegal=[] ooc=False 2.3s
- t5_follow_up / gemflash #0: 9 / 10  [ok] illegal=[] ooc=False 1.9s
- t5_follow_up / gemflash #1: 9 / 10  [ok] illegal=[] ooc=False 2.1s
- t5_follow_up / gemflash+flex #0: refused: This request triggered restrictions on violative cyber content and was blocked under Anthropic's Usage Policy. To learn  / 10  [ok] illegal=[] ooc=False 4.3s
- t5_follow_up / glm #0: 9 / 10  [ok] illegal=[] ooc=False 1.4s
- t5_follow_up / glm #1: refused: This request triggered restrictions on violative cyber content and was blocked under Anthropic's Usage Policy. To learn  / 10  [ok] illegal=[] ooc=False 1.2s
- t5_follow_up / haiku #0: refused: This request triggered restrictions on violative cyber content and was blocked under Anthropic's Usage Policy. To learn  / 9  [ok] illegal=[] ooc=False 3.4s
- t5_follow_up / haiku #1: 9 / 8  [ok] illegal=[] ooc=False 3.8s
- t5_follow_up / mimo #0: 9 / 10  [ok] illegal=[] ooc=False 10.8s
- t5_follow_up / mimo #1: refused: This request triggered restrictions on violative cyber content and was blocked under Anthropic's Usage Policy. To learn  / 10  [ok] illegal=[] ooc=False 12.8s
- t5_follow_up / terra #0: 9 / 10  [ok] illegal=[] ooc=False 1.8s
- t5_follow_up / terra #1: refused: This request triggered restrictions on violative cyber content and was blocked under Anthropic's Usage Policy. To learn  / 10  [ok] illegal=[] ooc=False 1.6s