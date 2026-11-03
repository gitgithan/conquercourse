import numpy as np
from ccpipe import suggest


def m(x0, y0, x1, y1, shape=(100, 100)):
    a = np.zeros(shape, bool)
    a[y0:y1, x0:x1] = True
    return a


def test_two_masks_of_one_thing_become_one_region():
    out = suggest.pick([{"label": "bench", "mask": m(10, 10, 50, 40), "score": 0.6}, {"label": "ledge", "mask": m(11, 10, 50, 41), "score": 0.8}], (100, 100))
    assert [c["label"] for c in out] == ["ledge"]


def test_tiny_masks_are_dropped_and_the_list_is_capped():
    cands = [{"label": "x", "mask": m(0, 0, 2, 2), "score": 0.9}] + [{"label": f"t{i}", "mask": m(i * 7, 0, i * 7 + 6, 6), "score": 0.5} for i in range(14)]
    out = suggest.pick(cands, (100, 100), limit=5)
    assert len(out) == 5 and all(c["label"] != "x" for c in out)


def test_describe_gives_box_in_photo_pixels_and_a_png():
    d = suggest.describe({"label": "wall", "mask": m(20, 30, 60, 50), "score": 0.71})
    assert d["box"] == [20, 30, 60, 50] and d["cutout"][:4] == b"\x89PNG" and d["score"] == 0.71


def test_box_item_takes_the_best_shape_inside_the_box():
    cands = [{"mask": m(10, 10, 60, 30), "score": 0.5}, {"mask": m(12, 10, 58, 30), "score": 0.8}]
    d = suggest.box_item(cands, [5, 5, 70, 40], (100, 100))
    assert d["score"] == 0.8 and d["box"] == [12, 10, 58, 30] and d["cutout"][:4] == b"\x89PNG" and d["label"] == "thing"


def test_box_item_refuses_a_shape_that_spills_out_or_is_a_speck_or_missing():
    assert suggest.box_item([{"mask": m(0, 0, 90, 90), "score": 0.9}], [40, 40, 60, 60], (100, 100)) is None
    assert suggest.box_item([{"mask": m(40, 40, 42, 42), "score": 0.9}], [10, 10, 90, 90], (100, 100)) is None
    assert suggest.box_item([], [10, 10, 90, 90], (100, 100)) is None


def test_bar_phrases_need_a_bar_shape():
    import numpy as np
    from ccpipe import suggest
    wide = np.zeros((600, 800), bool); wide[100:140, 100:400] = True
    tall = np.zeros((600, 800), bool); tall[100:400, 500:540] = True
    got = suggest.pick([{"label": "bar grid", "mask": wide, "score": .9}, {"label": "metal bars", "mask": tall, "score": .8},
                        {"label": "pole", "mask": tall, "score": .7}], (600, 800))
    assert [c["label"] for c in got] == ["bar grid", "pole"]
