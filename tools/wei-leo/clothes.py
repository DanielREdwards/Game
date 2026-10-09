# Roupa como deslocamento da própria malha: calça cargo larga com cinto e tênis (sem marca).
import numpy as np
from rigfit import GAME_BONES

BELT_TOP, BELT_BOT = 1.080, 1.036


def adjacency(F, n):
    nb = [set() for _ in range(n)]
    for f in F:
        k = len(f)
        for i in range(k):
            a, b = f[i], f[(i + 1) % k]
            nb[a].add(b)
            nb[b].add(a)
    return [np.array(sorted(s), int) for s in nb]


def vertex_normals(V, F):
    N = np.zeros_like(V)
    P = V[F]
    n = np.cross(P[:, 2] - P[:, 0], P[:, 3] - P[:, 1])
    for k in range(4):
        np.add.at(N, F[:, k], n)
    return N / (np.linalg.norm(N, axis=1, keepdims=True) + 1e-12)


def closest_on_polyline(p, pts):
    best = None
    total = sum(np.linalg.norm(pts[i + 1] - pts[i]) for i in range(len(pts) - 1))
    acc = 0.0
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        ab = b - a
        L = np.linalg.norm(ab)
        u = np.clip(np.dot(p - a, ab) / (L * L), 0, 1)
        q = a + ab * u
        d = np.linalg.norm(p - q)
        if best is None or d < best[0]:
            best = (d, q, (acc + u * L) / total, ab / L)
        acc += L
    return best


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def dress(V, F, rig, jidx, jw):
    """Devolve (V vestido, máscaras por vértice: pele, calça, cinto, tênis)."""
    n = len(V)
    used = np.unique(F)
    inF = np.zeros(n, bool)
    inF[used] = True
    N = vertex_normals(V, F)
    gi = {k: i for i, k in enumerate(GAME_BONES)}
    W = np.zeros((n, len(GAME_BONES)))
    np.put_along_axis(W, jidx, jw, 1)
    legL = W[:, gi['lHip']] + W[:, gi['lKn']]
    legR = W[:, gi['rHip']] + W[:, gi['rKn']]
    footL, footR = W[:, gi['lAnk']], W[:, gi['rAnk']]
    hips = W[:, gi['hips']]
    y = V[:, 1]
    below = 1 - smoothstep(BELT_TOP - 0.004, BELT_TOP + 0.002, y)
    out = V.copy()
    disp = np.zeros_like(V)

    # quadril: tecido solto sobre a pelve e os glúteos
    disp += (N * 0.014) * (hips * below)[:, None]
    # pernas: tubo largo e reto em torno do eixo coxa-joelho-tornozelo
    for s, leg in (('l', legL), ('r', legR)):
        pts = [rig[s + 'Hip']['world'], rig[s + 'Kn']['world'], rig[s + 'Ank']['world'] + np.array([0, -0.01, 0])]
        side = 1 if s == 'l' else -1
        for i in np.where((leg > 0.02) & inF)[0]:
            d, q, t, ax = closest_on_polyline(V[i], pts)
            r = V[i] - q
            r -= ax * np.dot(r, ax)
            rl = np.linalg.norm(r)
            if rl < 1e-6:
                continue
            u = r / rl
            R = np.interp(t, [0.0, 0.1, 0.3, 0.5, 0.75, 0.9, 1.0], [0.0, 0.114, 0.11, 0.104, 0.099, 0.097, 0.1])
            # parte de dentro (virada para a outra perna) fica mais justa
            inner = max(0.0, -u[0] * side)
            R *= 1 - 0.3 * inner
            # frente e trás: o tecido cai, achatando um pouco a seção
            R *= 1 - 0.1 * abs(u[2])
            newr = max(rl + 0.012, R)
            p = q + u * newr + ax * np.dot(V[i] - q, ax)
            # não cruzar o plano do meio
            if p[0] * side < 0.012:
                p[0] = 0.012 * side
            disp[i] += (p - V[i]) * leg[i] * below[i]
    out += disp
    # barra: desce e cobre o colarinho do tênis
    for s, leg, fw in (('l', legL, footL), ('r', legR, footR)):
        ank = rig[s + 'Ank']['world']
        sel = np.where(inF & (leg + fw > 0.3) & (fw < 0.5) & (V[:, 1] < 0.24))[0]
        k = 1 - smoothstep(0.12, 0.24, V[sel, 1])
        r = out[sel] - ank
        r[:, 1] = 0
        rl = np.linalg.norm(r, axis=1, keepdims=True) + 1e-9
        tgt = np.maximum(rl[:, 0], 0.1 * k + rl[:, 0] * (1 - k))
        out[sel, 0] = ank[0] + r[:, 0] / rl[:, 0] * tgt
        out[sel, 2] = ank[2] + r[:, 2] / rl[:, 0] * tgt + 0.012 * k
        out[sel, 1] = np.maximum(out[sel, 1] - 0.05 * k, 0.085)

    # cinto: faixa saliente
    belt = (y > BELT_BOT) & (y < BELT_TOP) & (hips + legL + legR > 0.3) & inF
    beltk = smoothstep(BELT_BOT - 0.004, BELT_BOT + 0.004, y) * (1 - smoothstep(BELT_TOP - 0.004, BELT_TOP + 0.001, y))
    out += N * (0.006 * beltk * (hips + legL + legR).clip(0, 1))[:, None]

    foot = ((footL > 0.5) | (footR > 0.5)) & inF
    masks = dict(
        pants=(below > 0.5) & ((hips + legL + legR + footL + footR) > 0.5) & ~foot & inF,
        belt=belt,
        shoe=foot,
    )
    masks['skin'] = inF & ~masks['pants'] & ~masks['shoe']
    return out, masks


def _old_shoe(V, F, n, out, foot, footL, footR, rig, inF):
    nb = adjacency(F, n)
    fi = np.where(foot)[0]
    fixed = np.array([any(not foot[j] for j in nb[i]) for i in fi])
    P = out.copy()
    for _ in range(40):
        avg = np.array([P[nb[i]].mean(0) for i in fi])
        P[fi[~fixed]] += 0.6 * (avg[~fixed] - P[fi[~fixed]])
    N2 = vertex_normals(P, F)
    shoe = P.copy()
    shoe[fi] += N2[fi] * 0.011
    for s, fw in (('l', footL), ('r', footR)):
        ank = rig[s + 'Ank']['world']
        sel = fi[fw[fi] > 0.5]
        # biqueira mais alta e redonda; calcanhar firme
        fwd = shoe[sel, 2] - ank[2]
        shoe[sel, 1] += np.clip(fwd - 0.08, 0, None) * 0.18
        # sola: tudo abaixo de 4 cm vai ao chão com borda reta
        low = shoe[sel, 1] < 0.045
        shoe[sel[low], 1] = np.where(shoe[sel[low], 1] < 0.03, 0.0, shoe[sel[low], 1])
        # sola um pouco mais larga que o cabedal
        c = np.array([ank[0], 0, 0])
        lat = shoe[sel, 0] - ank[0]
        k = (1 - smoothstep(0.02, 0.05, shoe[sel, 1]))
        shoe[sel, 0] += np.sign(lat) * 0.006 * k
    out[fi] = shoe[fi]
    masks = dict(
        pants=((below > 0.5) & ((hips + legL + legR) > 0.5) & ~foot & inF),
        belt=belt,
        shoe=foot,
    )
    masks['skin'] = inF & ~masks['pants'] & ~masks['shoe']
    return out, masks
