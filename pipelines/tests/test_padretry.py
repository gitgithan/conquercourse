import numpy as np

from ccpipe import padretry as P


def test_border_contact_per_side():
    m = np.zeros((100, 200), bool)
    m[:, :50] = True  # a wall that fills the left quarter and runs from top to bottom
    c = P.border_contact(m)
    assert c["left"] == 1.0 and c["right"] == 0.0
    assert abs(c["top"] - 0.25) < 1e-9 and abs(c["bottom"] - 0.25) < 1e-9
    assert P.touches_border(m)


def test_object_inside_does_not_touch():
    m = np.zeros((100, 200), bool)
    m[20:80, 40:160] = True
    assert not P.touches_border(m)


def test_pad_geometry_is_one_and_a_half_times():
    py, px, h, w = P.pad_sizes(800, 1000)
    assert (h, w) == (1200, 1500) and (py, px) == (200, 250)


def test_pad_keeps_object_pixels_and_clears_the_edge():
    rng = np.random.default_rng(1)
    img = rng.integers(0, 255, (40, 60, 3), dtype=np.uint8)
    m = np.zeros((40, 60), np.uint8)
    m[10:40, 0:30] = 255  # touches left and bottom
    pi, pm = P.pad_arrays(img, m)
    py, px, h, w = P.pad_sizes(40, 60)
    assert pi.shape == (h, w, 3) and pm.shape == (h, w)
    assert (pi[py:py + 40, px:px + 60] == img).all()          # the photo is unmoved inside the canvas
    assert (pm[py:py + 40, px:px + 60] == m).all()            # so is the mask
    assert int((pm > 0).sum()) == int((m > 0).sum())          # padding adds no mask
    assert not P.touches_border(pm > 0)
    assert (pi[0, px:px + 60] == img[0]).all()                # edge pixels repeated upward


def test_still_bad_and_decide():
    assert P.still_bad({"extent_aspect": 3.0, "mask_aspect": 1.0})
    assert not P.still_bad({"extent_aspect": 1.2, "mask_aspect": 1.0})
    assert P.decide(False, False, False) == ""
    assert P.decide(True, True, False) == "pad"
    assert P.decide(True, True, True) == "still"
