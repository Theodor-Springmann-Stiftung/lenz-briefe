import unittest
from transform_python.catalog import build_catalog, date_sort


class CatalogSortTests(unittest.TestCase):
    def test_attribute_priority(self):
        attributes = ['when', 'from', 'to', 'notBefore', 'notAfter']
        for index, expected in enumerate(attributes):
            dates = {name: f'{1800 - offset}-01-01'
                     for offset, name in enumerate(attributes[index:])}
            with self.subTest(expected=expected):
                result = date_sort([{'type': 'sent', 'dates': [dates]}])
                self.assertEqual(result['attribute'], expected)
                self.assertEqual(result['key'], [1800, 1, 1])

    def test_partial_dates_equal_first_day(self):
        def key(date):
            return date_sort([{'type': 'sent', 'dates': [date]}])['key']
        self.assertEqual(key({'when': '1796-09'}), key({'notBefore': '1796-09-01'}))
        self.assertEqual(key({'when': '1796'}), key({'when': '1796-01-01'}))

    def test_letter_number_breaks_date_ties_and_orders_undated_letters(self):
        def entry(number, date):
            return {'letter': str(number), 'events': [{'type': 'sent', 'dates': [date],
                                                     'persons': [], 'locations': []}]}
        catalog = build_catalog([
            entry(12, {}), entry(10, {'when': '1796-09'}), entry(3, {}),
            entry(2, {'notBefore': '1796-09-01'}), entry(1, {'when': '1796-09-02'}),
        ], {'yearGroups': [], 'personMap': {}, 'locationMap': {}})
        self.assertEqual([letter['letter'] for letter in catalog['letters']],
                         ['2', '10', '1', '3', '12'])
