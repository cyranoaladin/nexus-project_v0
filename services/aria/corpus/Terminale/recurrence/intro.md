# Suites et principe de récurrence

Le principe de récurrence permet de démontrer qu'une propriété $\mathcal{P}(n)$ est vraie pour tout entier naturel $n \geq n_0$.

1. **Initialisation** : on vérifie que $\mathcal{P}(n_0)$ est vraie.
2. **Hérédité** : on suppose que $\mathcal{P}(k)$ est vraie pour un entier $k \geq n_0$ et l'on montre qu'elle implique $\mathcal{P}(k+1)$.
3. **Conclusion** : $\mathcal{P}(n)$ est vraie pour tout $n \geq n_0$.

## Exemple guidé

Montrer, pour tout $n \geq 1$, que $2^n \geq n+1$.

- *Initialisation* : pour $n=1$, $2^1 = 2 \geq 2$.
- *Hérédité* : supposons $2^k \geq k+1$. Alors $2^{k+1} = 2 \cdot 2^k \geq 2(k+1) \geq (k+1)+1$.
- *Conclusion* : la propriété est vraie pour tout entier $n \geq 1$.

## Points d'attention

- Identifier clairement l'hypothèse de récurrence.
- Justifier chaque inégalité avec précision.
- Utiliser des exemples concrets pour tester la cohérence de la propriété.
